export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
}

const SYSTEM_PROMPT = `Du bist ein freundlicher Assistent der älteren Menschen hilft ihre Post zu verstehen.
Analysiere das Dokument (kann mehrere Seiten/Bilder sein) und antworte NUR mit einem validen JSON-Objekt ohne Markdown:
{
  "absender": "Name oder Behörde",
  "kategorie": "Behörde / Ämter|Gesundheit / Krankenkasse|Finanzen / Bank|Versicherung|Steuer / Finanzamt|Rechnungen / Mahnungen|Sonstiges",
  "steuerrelevant": true,
  "betrag": null,
  "zusammenfassung": "2-3 Sätze in einfacher Sprache was dieser Brief bedeutet",
  "dringlichkeit": "hoch|mittel|niedrig",
  "frist": null,
  "todos": [{"aufgabe": "Was genau zu tun ist", "frist": null, "erledigt": false}],
  "empfehlungen": ["Empfehlung"],
  "mailAntwortErforderlich": false,
  "mailVorlage": null
}

mailAntwortErforderlich ist true wenn eine Antwort per E-Mail erwartet wird oder sinnvoll ist.
Falls mailAntwortErforderlich true: mailVorlage befüllen mit:
{ "an": "E-Mail-Adresse des Absenders falls bekannt sonst leer", "betreff": "Betreff der Antwort", "text": "Vollständige höfliche Antwortmail auf Deutsch" }`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' })

  const { base64, mimeType, contentParts } = req.body

  // Support both single (legacy) and multi-image (new)
  let content
  if (contentParts && Array.isArray(contentParts)) {
    content = [...contentParts, { type: 'text', text: 'Analysiere dieses Dokument.' }]
  } else if (base64 && mimeType) {
    const isImg = mimeType.startsWith('image/')
    content = isImg
      ? [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: 'Analysiere diesen Brief.' }]
      : [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }, { type: 'text', text: 'Analysiere diesen Brief.' }]
  } else {
    return res.status(400).json({ error: 'base64/mimeType oder contentParts erforderlich' })
  }

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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'Claude API Fehler' })
    }

    const data = await response.json()
    const raw = data.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(raw)
    return res.status(200).json(result)

  } catch (err) {
    console.error('[/api/analyze]', err)
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' })
  }
}
