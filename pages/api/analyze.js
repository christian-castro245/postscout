import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseGermanDate } from '../../lib/dateUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Unterstützte Bild-Formate für die Claude Vision API.
// PDFs werden separat behandelt (document-Block statt image-Block).
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { dokumentId } = req.body || {};
  if (!dokumentId) {
    return res.status(400).json({ error: 'dokumentId required', received: req.body });
  }

  // Fetch document
  const { data: dok, error } = await supabase
    .from('dokumente')
    .select('*')
    .eq('id', dokumentId)
    .single();

  if (error || !dok) {
    return res.status(404).json({ error: 'Dokument nicht gefunden', detail: error?.message });
  }

  // Build content blocks for all photos/pages.
  // Bilder gehen als image-Block, PDFs als document-Block (Claude unterstützt beide nativ).
  const fileBlocks = [];
  const urls = Array.isArray(dok.bild_urls) ? dok.bild_urls : dok.bild_url ? [dok.bild_url] : [];

  for (const url of urls.slice(0, 5)) {
    try {
      const fileRes = await fetch(url);
      if (!fileRes.ok) continue;
      const buf = await fileRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      let ct = fileRes.headers.get('content-type') || 'image/jpeg';
      ct = ct.split(';')[0].trim(); // strip charset etc.

      if (ct === 'application/pdf') {
        fileBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: b64 },
        });
      } else if (SUPPORTED_IMAGE_TYPES.includes(ct)) {
        fileBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: ct, data: b64 },
        });
      } else {
        // Unbekannter Typ (z.B. octet-stream) — versuche als JPEG, Claude ist tolerant
        fileBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
        });
      }
    } catch (fetchErr) {
      console.error('Datei-Fetch fehlgeschlagen:', url, fetchErr.message);
      /* einzelne kaputte Datei überspringen, Rest weiter verarbeiten */
    }
  }

  if (fileBlocks.length === 0) {
    return res.status(422).json({ error: 'Keine lesbaren Dateien gefunden für dieses Dokument' });
  }

  const systemPrompt = `Du analysierst Dokumente (Briefe, Bescheide, Rechnungen) für ältere Menschen in Deutschland.
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

DATUM-REGEL: Erkannte Daten IMMER als YYYY-MM-DD formatieren. Heute ist ${new Date().toISOString().slice(0,10)}.
Falls ein Datum im Text steht (z.B. "02. Juli 2026") → "2026-07-02".
Falls kein Datum erkennbar → null. NIEMALS leere Strings oder unformatierte Daten.`;

  let analysisText = '';
  try {
    const msgContent = [
      ...fileBlocks,
      {
        type: 'text',
        text: `Analysiere dieses Dokument vollständig und gib das JSON zurück.${dok.raw_text ? `\n\nExtrahierter Text:\n${dok.raw_text}` : ''}`,
      },
    ];

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: msgContent }],
    });

    analysisText = msg.content[0]?.text || '{}';
  } catch (err) {
    console.error('Claude API error:', err);
    return res.status(500).json({ error: 'Analyse fehlgeschlagen' });
  }

  // Parse JSON safely
  let parsed = {};
  try {
    const cleaned = analysisText.replace(/```json\n?|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('JSON parse error:', analysisText.slice(0, 200));
    return res.status(500).json({ error: 'Analyse konnte nicht verarbeitet werden' });
  }

  // Sanitize dates: apply parseGermanDate to every date field
  const safeDate = (v) => parseGermanDate(v); // returns null if invalid

  const cleanedDoc = {
    titel: parsed.titel || 'Dokument',
    absender: parsed.absender || null,
    absender_email: parsed.absender_email || null,
    dringlichkeit: parsed.dringlichkeit || 'Zur Kenntnis',
    zusammenfassung: parsed.zusammenfassung || '',
    faelligkeitsdatum: safeDate(parsed.faelligkeitsdatum),
    antwort_erforderlich: Boolean(parsed.antwort_erforderlich),
    analysiert: true,
    aufgaben: (parsed.aufgaben || []).map(t => ({
      beschreibung: t.beschreibung || '',
      faelligkeitsdatum: safeDate(t.faelligkeitsdatum),
      empfehlung: t.empfehlung || null,
      antwort_erforderlich: Boolean(t.antwort_erforderlich),
      erledigt: false,
    })),
  };

  // Update document in DB
  const { error: updateError } = await supabase
    .from('dokumente')
    .update(cleanedDoc)
    .eq('id', dokumentId);

  if (updateError) {
    console.error('DB update error:', updateError);
    return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
  }

  res.json({ success: true, data: cleanedDoc });
}
