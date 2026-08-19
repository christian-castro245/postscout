import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' })

  const { dokument, profil, anweisung, kontakte } = req.body

  const absenderBlock = profil ? `${profil.vorname||''} ${profil.nachname||''}
${profil.strasse||''} ${profil.hausnummer||''}
${profil.plz||''} ${profil.ort||''}
${profil.telefon||''}`.trim() : 'Absender unbekannt'

  const kontakteBlock = kontakte?.length > 0
    ? `\nBEKANNTE KONTAKTE (falls relevant für Empfänger-Vorschlag):\n${kontakte.map(k=>`- ${k.name}${k.organisation?' ('+k.organisation+')':''}: ${[k.email,k.telefon].filter(Boolean).join(', ')}`).join('\n')}`
    : ''

  const system = `Du bist ein professioneller Briefassistent für ältere Menschen in Deutschland.
Erstelle ein höfliches, klares Anschreiben auf Deutsch.
Nutze bekannte Kontaktdaten wenn der Empfänger passt.
Antworte NUR mit einem JSON-Objekt (kein Markdown):
{
  "betreff": "Betreff des Briefes",
  "anschreiben": "Vollständiger Brieftext mit Anrede, Hauptteil und Grußformel",
  "empfaenger_name": "Name des Empfängers falls bekannt",
  "empfaenger_email": "E-Mail des Empfängers falls bekannt oder aus Kontakten"
}`

  const prompt = `Erstelle ein Anschreiben:

ABSENDER:
${absenderBlock}

BEZUG:
Von: ${dokument.absender || 'Unbekannt'}
Kategorie: ${dokument.kategorie}
Zusammenfassung: ${dokument.zusammenfassung}
Offene Aufgaben: ${(dokument.todos || []).filter(t=>t.status!=='erledigt').map(t => t.aufgabe).join(', ')}
${kontakteBlock}
${anweisung ? `\nGEWÜNSCHTE AKTION: ${anweisung}` : 'Reagiere angemessen auf den Brief.'}

Datum: ${new Date().toLocaleDateString('de-DE')}
Einfache, freundliche Sprache.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!response.ok) { const e = await response.json(); return res.status(response.status).json({ error: e.error?.message }) }
    const data = await response.json()
    const raw = data.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
