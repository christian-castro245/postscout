// POST /api/imap-sync
// Wird via Vercel Cron stündlich aufgerufen
// Liest neue Mails per IMAP, speichert sie in Supabase Storage + DB

import { createClient } from '@supabase/supabase-js'
import { ANALYSE_SYSTEM_PROMPT } from '../../lib/analysePrompt'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req, res) {
  // Cron auth check
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  let processed = 0

  try {
    // Get all active IMAP settings
    const { data: imapConfigs } = await supabaseAdmin
      .from('imap_settings')
      .select('*')
      .eq('aktiv', true)

    for (const config of imapConfigs || []) {
      try {
        const count = await syncMailbox(config, apiKey)
        processed += count
      } catch (e) {
        console.error(`IMAP sync failed for user ${config.user_id}:`, e.message)
      }
    }

    return res.status(200).json({ ok: true, processed })
  } catch (err) {
    console.error('[/api/imap-sync]', err)
    return res.status(500).json({ error: err.message })
  }
}

async function syncMailbox(imapConfig, apiKey) {
  // Dynamic import of imapflow
  const { ImapFlow } = await import('imapflow')

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: true,
    auth: {
      user: imapConfig.username,
      pass: imapConfig.password_encrypted, // stored as-is for MVP
    },
    logger: false,
  })

  await client.connect()
  let processed = 0

  try {
    await client.mailboxOpen('INBOX')

    // Only fetch mails newer than last sync UID
    const lastUid = imapConfig.letzter_uid || 0
    const searchCriteria = lastUid > 0
      ? { uid: `${lastUid + 1}:*` }
      : { seen: false } // First run: only unseen mails

    let maxUid = lastUid

    for await (const message of client.fetch(searchCriteria, {
      uid: true, flags: true, envelope: true,
      bodyStructure: true, source: true,
    })) {
      try {
        const uid = message.uid
        if (uid <= lastUid) continue
        if (uid > maxUid) maxUid = uid

        // Build .eml content
        const emlContent = message.source
        const subject = message.envelope?.subject || '(Kein Betreff)'
        const from = message.envelope?.from?.[0]?.address || ''
        const date = message.envelope?.date || new Date()

        // Store .eml in Supabase Storage
        const ts = Date.now()
        const emlPath = `${imapConfig.user_id}/imap/${ts}_${uid}.eml`
        await supabaseAdmin.storage.from('dokumente').upload(
          emlPath, emlContent,
          { contentType: 'message/rfc822', upsert: false }
        )

        // Extract attachments
        const attachments = []
        const contentParts = []

        if (message.bodyStructure) {
          const parts = flattenBodyStructure(message.bodyStructure)
          for (const part of parts) {
            if (part.disposition === 'attachment' || part.disposition === 'inline') {
              try {
                const partData = await client.fetchOne(
                  String(uid),
                  { bodyParts: [part.part] },
                  { uid: true }
                )
                const buffer = partData.bodyParts?.get(part.part)
                if (!buffer) continue

                const mimeType = `${part.type}/${part.subtype}`
                const filename = part.dispositionParameters?.filename ||
                  part.parameters?.name || `attachment_${part.part}`
                const attPath = `${imapConfig.user_id}/imap/${ts}_${uid}_${filename}`

                await supabaseAdmin.storage.from('dokumente').upload(
                  attPath, buffer, { contentType: mimeType, upsert: false }
                )
                attachments.push({ name: filename, storage_path: attPath, mime_type: mimeType })

                // Add to Claude content if image or PDF
                if (mimeType.startsWith('image/')) {
                  contentParts.push({
                    type: 'image',
                    source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') }
                  })
                } else if (mimeType === 'application/pdf') {
                  contentParts.push({
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }
                  })
                }
              } catch (e) {
                console.error('Attachment extract error:', e.message)
              }
            }
          }
        }

        // Build analysis content
        const emailText = `Von: ${from}\nBetreff: ${subject}\nDatum: ${new Date(date).toLocaleDateString('de-DE')}\n\n${subject}`
        contentParts.unshift({ type: 'text', text: `E-Mail analysieren:\n\n${emailText}` })

        // Analyse with Claude
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: ANALYSE_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: contentParts }],
          }),
        })

        const claudeData = await claudeRes.json()
        const raw = claudeData.content[0].text.trim()
          .replace(/^```json\s*/i, '').replace(/\s*```$/, '')
        const result = JSON.parse(raw)

        // Skip pure advertising
        if (result.dringlichkeit === 'ignorieren' && !attachments.length) {
          processed++
          continue
        }

        // Save to DB
        await supabaseAdmin.from('dokumente').insert({
          user_id: imapConfig.user_id,
          dateiname: `E-Mail: ${subject}`,
          storage_path: emlPath,
          original_email_path: emlPath,
          mime_type: 'message/rfc822',
          quelle: 'imap',
          anhaenge: attachments,
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

        processed++
      } catch (msgErr) {
        console.error('Message processing error:', msgErr.message)
      }
    }

    // Update last synced UID
    if (maxUid > lastUid) {
      await supabaseAdmin.from('imap_settings')
        .update({ letzter_uid: maxUid, letzter_sync: new Date().toISOString() })
        .eq('id', imapConfig.id)
    }

  } finally {
    await client.logout()
  }

  return processed
}

function flattenBodyStructure(part, path = '1') {
  const result = []
  if (part.childNodes) {
    part.childNodes.forEach((child, i) => {
      result.push(...flattenBodyStructure(child, path === '1' ? String(i + 1) : `${path}.${i + 1}`))
    })
  } else {
    result.push({ ...part, part: path })
  }
  return result
}

function parseFrist(frist) {
  if (!frist) return null
  const parts = frist.split('.')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return null
}
