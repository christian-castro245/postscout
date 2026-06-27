import { ANALYSE_SYSTEM_PROMPT } from '../../lib/analysePrompt'

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' })

  const { base64, mimeType, contentParts } = req.body

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: ANALYSE_SYSTEM_PROMPT, messages: [{ role: 'user', content }] }),
    })
    if (!response.ok) { const e = await response.json(); return res.status(response.status).json({ error: e.error?.message }) }
    const data = await response.json()
    const raw = data.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
