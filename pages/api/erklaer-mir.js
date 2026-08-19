// POST /api/erklaer-mir
// Body: { docId, zusammenfassung, frage }
// Returns: { antwort: "..." }
// Erklärt Briefinhalte in einfacher Sprache für Senioren

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const FRAGEN_KONTEXT = {
  'was_tun':     'Was genau muss ich tun? Bitte ganz konkret und in einfachen Worten.',
  'bis_wann':    'Bis wann muss ich handeln? Gibt es eine Frist oder einen Stichtag?',
  'nichts_tun':  'Was passiert, wenn ich diesen Brief ignoriere oder nichts unternehme?',
  'einfach':     'Erkläre mir den Brief in ganz einfachen Worten, wie für jemanden der sich mit Behördensprache nicht auskennt.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' })

  const { zusammenfassung, frage } = req.body
  if (!zusammenfassung || !frage) return res.status(400).json({ error: 'zusammenfassung und frage erforderlich' })

  const frageText = FRAGEN_KONTEXT[frage] || frage

  const prompt = `Du hilfst älteren Menschen dabei, Briefe und Behördenschreiben zu verstehen.

Hier ist die Zusammenfassung eines Briefes:
"${zusammenfassung}"

Beantworte folgende Frage in sehr einfacher, ruhiger Sprache — wie ein geduldiger Mensch das seiner Oma oder seinem Opa erklären würde:
${frageText}

Wichtige Regeln:
- Kein Behördenjargon, keine Fachbegriffe
- Kurze Sätze (maximal 15 Wörter pro Satz)
- Maximal 3–4 Sätze
- Beruhigend und klar, nicht alarmierend
- Wenn die Antwort unklar ist weil die Zusammenfassung nicht genug Info hat, sag das ehrlich und einfach
- Beginne direkt mit der Antwort, ohne Vorreden wie "Natürlich" oder "Gerne"

Antworte NUR mit der Antwort, nichts anderes.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const antwort = msg.content[0]?.text?.trim() || ''
    res.json({ antwort })
  } catch (err) {
    console.error('[/api/erklaer-mir]', err)
    res.status(500).json({ error: 'Fehler beim Generieren' })
  }
}
