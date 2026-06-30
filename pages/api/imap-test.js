// POST /api/imap-test – Tests IMAP connection without storing

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })
  const { host, port, username, password_encrypted } = req.body
  if (!host || !username || !password_encrypted) return res.status(400).json({ error: 'Fehlende Parameter' })

  try {
    const { ImapFlow } = await import('imapflow')
    const client = new ImapFlow({
      host, port: port || 993, secure: true,
      auth: { user: username, pass: password_encrypted },
      logger: false,
    })
    await client.connect()
    await client.mailboxOpen('INBOX')
    const status = await client.status('INBOX', { messages: true, unseen: true })
    await client.logout()
    return res.status(200).json({ ok: true, count: status.unseen || 0 })
  } catch (err) {
    return res.status(400).json({ error: 'Verbindung fehlgeschlagen: ' + err.message })
  }
}
