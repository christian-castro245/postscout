import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseGermanDate } from '../../lib/dateUtils';

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const SYSTEM_PROMPT = `Du analysierst Dokumente (Briefe, Bescheide, Rechnungen) für ältere Menschen in Deutschland.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Text davor oder danach.

JSON-Schema:
{
  "titel": "Kurztitel des Dokuments (max 60 Zeichen)",
  "absender": "Name der sendenden Organisation/Person",
  "absender_email": "E-Mail-Adresse falls erkennbar, sonst null",
  "dringlichkeit": "Überfällig" | "Dringend" | "Mittelfristig" | "Zur Kenntnis" | "Werbung/Ignorieren",
  "zusammenfassung": "2-3 Sätze in einfachem Deutsch was in dem Dokument steht",
  "faelligkeitsdatum": "YYYY-MM-DD oder null wenn kein konkretes Datum erkennbar",
  "antwort_erforderlich": true | false,
  "aufgaben": [
    {
      "beschreibung": "Konkrete Aufgabe in einfacher Sprache",
      "faelligkeitsdatum": "YYYY-MM-DD oder null",
      "empfehlung": "Was die Person konkret tun soll (optional)",
      "antwort_erforderlich": true | false
    }
  ]
}

DATUM-REGEL: Erkannte Daten IMMER als YYYY-MM-DD formatieren. Heute ist ${new Date().toISOString().slice(0, 10)}.
Falls ein Datum im Text steht (z.B. "02. Juli 2026") → "2026-07-02".
Falls kein Datum erkennbar → null. NIEMALS leere Strings oder unformatierte Daten.`;

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
        if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break; // --boundary--
        if (buf[pos] === 0x0d) pos += 2; // \r\n
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

  // ── Auth: JWT aus Authorization-Header extrahieren ──────────────────────
  const authHeader = req.headers['authorization'] || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' });

  // User-Session validieren
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' });

  // ── Multipart parsen ────────────────────────────────────────────────────
  let parts;
  try {
    parts = await parseMultipart(req);
  } catch (e) {
    return res.status(400).json({ error: `Multipart-Fehler: ${e.message}` });
  }

  const fileParts = parts.filter(p => p.filename);
  if (!fileParts.length) return res.status(400).json({ error: 'Keine Dateien erhalten' });

  // ── Claude-Blöcke direkt aus Multipart-Buffer bauen (kein Re-Download) ──
  const fileBlocks = [];
  const ts = Date.now();
  const storageMeta = fileParts.slice(0, 5).map((part, i) => {
    const ext = part.filename.split('.').pop() || 'jpg';
    const mimeType = part.contentType || 'image/jpeg';
    const ct = mimeType.split(';')[0].trim();
    const path = `${user.id}/${ts}_${i}.${ext}`;

    const b64 = part.data.toString('base64');
    if (ct === 'application/pdf') {
      fileBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
    } else if (SUPPORTED_IMAGE_TYPES.includes(ct)) {
      fileBlocks.push({ type: 'image', source: { type: 'base64', media_type: ct, data: b64 } });
    } else {
      fileBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
    }
    return { path, data: part.data, mimeType: ct };
  });

  if (!fileBlocks.length) return res.status(422).json({ error: 'Keine lesbaren Dateien' });

  // ── Storage-Upload + DB-Insert parallel zu Claude starten ─────────────
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
    .insert({
      user_id:       user.id,
      dateiname:     fileParts[0].filename,
      analysiert:    false,
      dringlichkeit: 'niedrig',
    })
    .select('id')
    .single();

  // ── Claude + Upload/Insert parallel ────────────────────────────────────
  let analysisText = '';
  let uploadedUrls, dok, insertErr;

  try {
    [analysisText, uploadedUrls, { data: dok, error: insertErr }] = await Promise.all([
      anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: [...fileBlocks, { type: 'text', text: 'Analysiere dieses Dokument vollständig und gib das JSON zurück.' }] }],
      }).then(msg => msg.content[0]?.text || '{}'),
      uploadPromise,
      insertPromise,
    ]);
  } catch (err) {
    console.error('Parallel error:', err);
    return res.status(500).json({ error: err.message });
  }

  if (insertErr || !dok?.id) return res.status(500).json({ error: `DB-Insert fehlgeschlagen: ${insertErr?.message}` });
  const dokumentId = dok.id;

  // bild_url nachträglich eintragen (Upload war parallel)
  await supabase.from('dokumente').update({
    bild_url:  uploadedUrls[0] || null,
    bild_urls: uploadedUrls,
  }).eq('id', dokumentId);

  // ── JSON parsen ─────────────────────────────────────────────────────────
  let parsed = {};
  try {
    parsed = JSON.parse(analysisText.replace(/```json\n?|```/g, '').trim());
  } catch {
    console.error('JSON parse error:', analysisText.slice(0, 200));
    return res.status(500).json({ error: 'Analyse konnte nicht verarbeitet werden' });
  }

  const safeDate = v => parseGermanDate(v);

  const DRING_MAP = {
    'Überfällig': 'ueberfaellig',
    'Dringend': 'hoch',
    'Mittelfristig': 'mittel',
    'Zur Kenntnis': 'niedrig',
    'Werbung/Ignorieren': 'ignorieren',
  };
  const dring = DRING_MAP[parsed.dringlichkeit] || 'niedrig';

  const aufgaben = (parsed.aufgaben || []).map(t => ({
    beschreibung:         t.beschreibung || '',
    faelligkeitsdatum:    safeDate(t.faelligkeitsdatum),
    empfehlung:           t.empfehlung || null,
    antwort_erforderlich: Boolean(t.antwort_erforderlich),
    erledigt:             false,
  }));

  const cleanedDoc = {
    titel:                parsed.titel || 'Dokument',
    absender:             parsed.absender || null,
    absender_email:       parsed.absender_email || null,
    dringlichkeit:        dring,
    zusammenfassung:      parsed.zusammenfassung || '',
    faelligkeitsdatum:    safeDate(parsed.faelligkeitsdatum),
    antwort_erforderlich: Boolean(parsed.antwort_erforderlich),
    analysiert:           true,
    aufgaben,
    todos: aufgaben.map(t => ({
      aufgabe:      t.beschreibung,
      frist:        t.faelligkeitsdatum,
      dringlichkeit: dring,
      status:       'offen',
      erledigt:     false,
    })),
  };

  const { error: updateErr } = await supabase
    .from('dokumente').update(cleanedDoc).eq('id', dokumentId);

  if (updateErr) {
    console.error('DB update error:', updateErr);
    return res.status(500).json({ error: `Speichern fehlgeschlagen: ${updateErr.message}` });
  }

  res.json({ success: true, dokumentId, data: cleanedDoc });
}
