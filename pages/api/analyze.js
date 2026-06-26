// pages/api/analyze.js
// ─────────────────────────────────────────────────────────────────────────────
// Serverseitige API Route – Claude API Key bleibt sicher auf dem Server.
// Der Browser schickt nur die Bilddaten, niemals den Key.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

const SYSTEM_PROMPT = `Du bist ein freundlicher Assistent der älteren Menschen hilft ihre Post zu verstehen.
Analysiere das Dokument und antworte NUR mit einem validen JSON-Objekt (kein Markdown, keine Backticks):
{
  "absender": "Name oder Behörde",
  "kategorie": "Behörde / Ämter|Gesundheit / Krankenkasse|Finanzen / Bank|Versicherung|Steuer / Finanzamt|Rechnungen / Mahnungen|Sonstiges",
  "steuerrelevant": true,
  "betrag": null,
  "zusammenfassung": "2-3 Sätze in einfacher Sprache",
  "dringlichkeit": "hoch|mittel|niedrig",
  "frist": null,
  "todos": [{"aufgabe": "Was zu tun ist", "frist": null, "erledigt": false}],
  "empfehlungen": ["Empfehlung 1"]
}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST erlaubt' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const { base64, mimeType } = req.body
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'base64 und mimeType erforderlich' })
  }

  const isImage = mimeType.startsWith('image/')
  const content = isImage
    ? [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Analysiere diesen Brief.' },
      ]
    : [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'Analysiere diesen Brief.' },
      ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'Claude API Fehler' })
    }

    const data = await response.json()
    const raw = data.content[0].text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')

    const result = JSON.parse(raw)
    return res.status(200).json(result)

  } catch (err) {
    console.error('[/api/analyze]', err)
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' })
  }
}
