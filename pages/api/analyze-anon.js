import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseGermanDate } from '../../lib/dateUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Analyse-Route für den anonymen Scan-Only-Flow (Familienmitglieder ohne eigenen
// Account, Zugriff per Scan-Token). Bekommt die Bilder direkt als Base64 statt
// über eine dokumentId, weil zu diesem Zeitpunkt noch kein Dokument in der DB
// existiert — das passiert erst danach in /api/scan-only-save.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contentParts, userId } = req.body || {};
  if (!Array.isArray(contentParts) || contentParts.length === 0) {
    return res.status(400).json({ error: 'contentParts required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const systemPrompt = `Du analysierst Dokumente (Briefe, Bescheide, Rechnungen) für ältere Menschen in Deutschland.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Text davor oder danach.

JSON-Schema:
{
  "kategorie": "Kurze Kategorie (z.B. Behörde, Versicherung, Rechnung, Werbung)",
  "absender": "Name der sendenden Organisation/Person",
  "zusammenfassung": "2-3 Sätze in einfachem Deutsch was in dem Dokument steht",
  "dringlichkeit": "Überfällig" | "Dringend" | "Mittelfristig" | "Zur Kenntnis" | "Werbung/Ignorieren",
  "frist": "DD.MM.YYYY oder null wenn kein konkretes Datum erkennbar",
  "betrag": "Betrag in Euro als Zahl, oder null",
  "steuerrelevant": true | false,
  "todos": [
    { "beschreibung": "Konkrete Aufgabe in einfacher Sprache", "dringlichkeit": "wie oben" }
  ],
  "empfehlungen": ["Kurze konkrete Handlungsempfehlung"]
}

DATUM-REGEL: Erkannte Daten als DD.MM.YYYY formatieren. Heute ist ${new Date().toISOString().slice(0, 10)}.
Falls kein Datum erkennbar → null. NIEMALS leere Strings oder unformatierte Daten.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentParts }],
    });

    const raw = msg.content[0]?.text || '{}';
    const cleaned = raw.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    res.json({
      kategorie: parsed.kategorie || 'Sonstiges',
      absender: parsed.absender || null,
      zusammenfassung: parsed.zusammenfassung || '',
      dringlichkeit: parsed.dringlichkeit || 'Zur Kenntnis',
      frist: parsed.frist || null,
      betrag: parsed.betrag || null,
      steuerrelevant: Boolean(parsed.steuerrelevant),
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      empfehlungen: Array.isArray(parsed.empfehlungen) ? parsed.empfehlungen : [],
    });
  } catch (err) {
    console.error('analyze-anon error:', err);
    res.status(500).json({ error: 'Analyse fehlgeschlagen', detail: err.message });
  }
}
