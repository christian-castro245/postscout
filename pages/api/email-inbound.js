// POST /api/email-inbound
// Empfängt weitergeleitete E-Mails via Resend Inbound Webhook
// Setup: resend.com → Inbound → Domain → Webhook URL: https://deine-app.vercel.app/api/email-inbound

import { createClient } from '@supabase/supabase-js'
import { ANALYSE_SYSTEM_PROMPT } from '../../lib/analysePrompt'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  try {
    const payload = req.body
    // Resend Inbound Webhook payload
    const from = payload.from || ''
    const subject = payload.subject || '(Kein Betreff)'
    const textBody = payload.text || payload.html?.replace(/<[^>]*>/g, '') || ''
    const attachments = payload.attachments || []

    // Find user by their PostScout inbound address
    // Format: briefe+USERID@postscout.app → extract user ID
    const toAddress = payload.to?.[0]?.email || ''
    const userIdMatch = toAddress.match(/briefe\+([^@]+)@/)
    if (!userIdMatch) return res.status(400).json({ error: 'Kein User-ID in Empfängeradresse' })
    const userId = userIdMatch[1]

    // Build content for Claude
    const contentParts = []

    // Add email text as document
    const emailText = `Von: ${from}\nBetreff: ${subject}\n\n${textBody}`
    contentParts.push({ type: 'text', text: `E-Mail analysieren:\n\n${emailText}` })

    // Add attachments (images/PDFs)
    for (const att of attachments.slice(0, 5)) {
      if (!att.content) continue
      const mimeType = att.content_type || 'application/octet-stream'
      if (mimeType.startsWith('image/')) {
        contentParts.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: att.content } })
      } else if (mimeType === 'application/pdf') {
        contentParts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.content } })
      }
    }

    // Analyse with Claude
    const apiKey = process.env.ANTHROPIC_API_KEY
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: ANALYSE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentParts }],
      }),
    })

    const claudeData = await claudeRes.json()
    const raw = claudeData.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(raw)

    // Save to Supabase
    await supabaseAdmin.from('dokumente').insert({
      user_id: userId,
      dateiname: `E-Mail: ${subject}`,
      storage_path: `email/${userId}/${Date.now()}`,
      mime_type: 'message/rfc822',
      kategorie: result.kategorie,
      absender: result.absender || from,
      zusammenfassung: result.zusammenfassung,
      dringlichkeit: result.dringlichkeit,
      frist: parseFrist(result.frist),
      betrag: result.betrag,
      steuerrelevant: result.steuerrelevant,
      jahr: new Date().getFullYear(),
      todos: (result.todos || []).map(t => ({ ...t, dringlichkeit: t.dringlichkeit || result.dringlichkeit })),
      empfehlungen: result.empfehlungen || [],
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[/api/email-inbound]', err)
    return res.status(500).json({ error: err.message })
  }
}

function parseFrist(frist) {
  if (!frist) return null
  const parts = frist.split('.')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return null
}
