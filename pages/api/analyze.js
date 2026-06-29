import { ANALYSE_SYSTEM_PROMPT } from '../../lib/analysePrompt'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY fehlt' })

  const { base64, mimeType, contentParts, userId } = req.body

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

  // Duplikat-Erkennung: Hash der Bilddaten
  let inhaltsHash = null
  let duplikat = null
  if (userId) {
    const hashInput = contentParts
      ? contentParts.filter(p => p.source?.data).map(p => p.source.data).join('')
      : (base64 || '')
    inhaltsHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 32)

    // Prüfen ob dieser Hash schon existiert
    const { data: existing } = await supabaseAdmin
      .from('dokumente')
      .select('id, absender, dateiname, erstellt_am')
      .eq('user_id', userId)
      .eq('inhalts_hash', inhaltsHash)
      .single()

    if (existing) {
      duplikat = {
        id: existing.id,
        absender: existing.absender || existing.dateiname,
        erstellt_am: existing.erstellt_am,
      }
    }
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
    const result = JSON.parse(raw)
    return res.status(200).json({ ...result, inhaltsHash, duplikat })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
