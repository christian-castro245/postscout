import { createClient } from '@supabase/supabase-js';
import { parseGermanDate } from '../../lib/dateUtils';
import { getAnalyseProvider } from '../../lib/analyse/index.js';
import { pseudonymisiere, rehydriere } from '../../lib/pseudonym/index.js';

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const DRING_MAP = {
  'Überfällig': 'ueberfaellig',
  'Dringend': 'hoch',
  'Mittelfristig': 'mittel',
  'Zur Kenntnis': 'niedrig',
  'Werbung/Ignorieren': 'ignorieren',
};

// Dringlichkeit aus Fälligkeitsdatum ableiten wenn das Modell keine liefert
function dringlichkeitAusFrist(datum) {
  if (!datum) return 'niedrig';
  const tage = Math.floor((new Date(datum) - new Date()) / 86400000);
  if (tage < 0) return 'ueberfaellig';
  if (tage <= 14) return 'hoch';
  if (tage <= 60) return 'mittel';
  return 'niedrig';
}

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const boundary = (() => {
      const ct = req.headers['content-type'] || '';
      const m = ct.match(/boundary=([^\s;]+)/);
      return m ? m[1] : null;
    })();
    if (!boundary) return reject(new Error('No boundary in multipart'));

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const parts = [];
      const sep = Buffer.from(`--${boundary}`);
      let pos = 0;
      while (pos < buf.length) {
        const start = buf.indexOf(sep, pos);
        if (start === -1) break;
        pos = start + sep.length;
        if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break;
        if (buf[pos] === 0x0d) pos += 2;
        else if (buf[pos] === 0x0a) pos += 1;
        const headerEnd = buf.indexOf('\r\n\r\n', pos);
        if (headerEnd === -1) break;
        const headerStr = buf.slice(pos, headerEnd).toString();
        pos = headerEnd + 4;
        const nextSep = buf.indexOf(sep, pos);
        const bodyEnd = nextSep === -1 ? buf.length : nextSep - 2;
        const body = buf.slice(pos, bodyEnd);
        pos = nextSep === -1 ? buf.length : nextSep;
        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        parts.push({
          name: nameMatch?.[1],
          filename: filenameMatch?.[1],
          contentType: ctMatch?.[1]?.trim(),
          data: body,
        });
      }
      resolve(parts);
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' });

  let parts;
  try {
    parts = await parseMultipart(req);
  } catch (e) {
    return res.status(400).json({ error: `Multipart-Fehler: ${e.message}` });
  }

  const fileParts = parts.filter(p => p.filename);
  if (!fileParts.length) return res.status(400).json({ error: 'Keine Dateien erhalten' });

  const ts = Date.now();
  const storageMeta = fileParts.slice(0, 5).map((part, i) => {
    const ext = part.filename.split('.').pop() || 'jpg';
    const mimeType = part.contentType || 'image/jpeg';
    const ct = mimeType.split(';')[0].trim();
    const path = `${user.id}/${ts}_${i}.${ext}`;
    return { path, data: part.data, mimeType: ct, filename: part.filename };
  });

  if (!storageMeta.length) return res.status(422).json({ error: 'Keine lesbaren Dateien' });

  // Storage-Upload + DB-Insert parallel starten
  const uploadPromise = (async () => {
    const urls = [];
    for (const { path, data, mimeType } of storageMeta) {
      const { error: upErr } = await supabase.storage
        .from('dokumente').upload(path, data, { upsert: true, contentType: mimeType });
      if (upErr) throw new Error(`Storage-Upload fehlgeschlagen: ${upErr.message}`);
      const { data: urlData } = supabase.storage.from('dokumente').getPublicUrl(path);
      urls.push(urlData?.publicUrl || '');
    }
    return urls;
  })();

  const insertPromise = supabase
    .from('dokumente')
    .insert({ user_id: user.id, dateiname: fileParts[0].filename, analysiert: false, dringlichkeit: 'niedrig' })
    .select('id')
    .single();

  let uploadedUrls, dok, insertErr;
  try {
    [uploadedUrls, { data: dok, error: insertErr }] = await Promise.all([uploadPromise, insertPromise]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (insertErr || !dok?.id) return res.status(500).json({ error: `DB-Insert fehlgeschlagen: ${insertErr?.message}` });
  const dokumentId = dok.id;

  await supabase.from('dokumente').update({ bild_url: uploadedUrls[0] || null, bild_urls: uploadedUrls }).eq('id', dokumentId);

  // Für multipage-Dokumente: Text aus Bildblöcken extrahieren (Claude Vision)
  // Der Provider bekommt hier einen kombinierten Texthint + Bild-Marker
  // Für Text-basierte Providers (Bedrock text-only) wäre hier ein OCR-Schritt nötig
  const bildBeschreibung = storageMeta.length > 1
    ? `${storageMeta.length} Seiten Dokument. Analysiere alle Seiten als zusammenhängendes Dokument.`
    : 'Einzelseiten-Dokument.'

  // Pseudonymisierung (Feature-Flag: PSEUDONYMISIERUNG_AKTIV)
  // Für Vision-basierte Analyse: Pseudonymisierung greift auf extrahierten Text
  // Da der Provider Bilder direkt erhält, pseudonymisieren wir den Prompt-Text
  const pseudoAktiv = process.env.PSEUDONYMISIERUNG_AKTIV === 'true';
  let analyseText = bildBeschreibung;
  let pseudoZuordnung = new Map();
  let pseudoTypen = [];

  if (pseudoAktiv) {
    const pseudo = pseudonymisiere(bildBeschreibung);
    analyseText = pseudo.text;
    pseudoZuordnung = pseudo.zuordnung;
    pseudoTypen = pseudo.gefundeneTypen;
  }

  // Analyse über Provider
  let analyseErgebnis;
  try {
    const provider = getAnalyseProvider();
    analyseErgebnis = await provider.analysiere(analyseText);
  } catch (err) {
    return res.status(500).json({ error: `Analyse fehlgeschlagen: ${err.message}` });
  }

  // Rehydrierung: Platzhalter in allen Textfeldern ersetzen
  if (pseudoAktiv && pseudoZuordnung.size > 0) {
    analyseErgebnis.titel = rehydriere(analyseErgebnis.titel, pseudoZuordnung);
    analyseErgebnis.absender = rehydriere(analyseErgebnis.absender, pseudoZuordnung);
    analyseErgebnis.zusammenfassung = rehydriere(analyseErgebnis.zusammenfassung, pseudoZuordnung);
    analyseErgebnis.aufgaben = analyseErgebnis.aufgaben.map(a => ({
      ...a,
      text: rehydriere(a.text, pseudoZuordnung),
    }));
    if (analyseErgebnis.konfidenz?.hinweis) {
      analyseErgebnis.konfidenz.hinweis = rehydriere(analyseErgebnis.konfidenz.hinweis, pseudoZuordnung);
    }
    // Zuordnungstabelle explizit verwerfen (nie persistieren)
    pseudoZuordnung.clear();
  }

  const dring = dringlichkeitAusFrist(analyseErgebnis.faelligkeitsdatum);

  const aufgaben = analyseErgebnis.aufgaben.map(a => ({
    beschreibung:         a.text,
    faelligkeitsdatum:    a.faelligkeitsdatum,
    antwort_erforderlich: false,
    typ:                  'aktion',
    betrag:               null,
    empfaenger:           null,
    iban:                 null,
    bic:                  null,
    verwendungszweck:     null,
    belegstelle:          null,
    belegstelle_bbox:     null,
    erledigt:             false,
  }));

  const cleanedDoc = {
    titel:                analyseErgebnis.titel || 'Dokument',
    absender:             analyseErgebnis.absender || null,
    absender_email:       analyseErgebnis.absenderEmail || null,
    dringlichkeit:        dring,
    zusammenfassung:      analyseErgebnis.zusammenfassung || '',
    faelligkeitsdatum:    analyseErgebnis.faelligkeitsdatum,
    antwort_erforderlich: analyseErgebnis.antwortErforderlich,
    analysiert:           true,
    aufgaben,
    todos: aufgaben.map(a => ({
      aufgabe:          a.beschreibung,
      frist:            a.faelligkeitsdatum,
      dringlichkeit:    dring,
      status:           'offen',
      erledigt:         false,
      typ:              a.typ,
    })),
  };

  const { error: updateErr } = await supabase.from('dokumente').update(cleanedDoc).eq('id', dokumentId);

  if (updateErr) {
    return res.status(500).json({ error: `Speichern fehlgeschlagen: ${updateErr.message}` });
  }

  res.json({ success: true, dokumentId, data: cleanedDoc });
}
