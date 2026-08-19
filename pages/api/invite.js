// POST /api/invite
// Body: { ownerUserId, inviteeEmail, permission, inviteToken }
// Sends invitation email via Resend

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const resendKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://postscout-beige.vercel.app'

  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY fehlt' })

  const { inviteeEmail, ownerName, permission, inviteToken } = req.body
  if (!inviteeEmail || !inviteToken) return res.status(400).json({ error: 'inviteeEmail und inviteToken erforderlich' })

  const permLabel = {
    lesen: 'Dokumente und Aufgaben ansehen',
    abhaken: 'Aufgaben ansehen und abhaken',
    notizen: 'Aufgaben abhaken und Notizen hinzufügen',
  }[permission] || 'Dokumente ansehen'

  const inviteUrl = `${appUrl}/join?token=${inviteToken}`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Postklar <noreply@postklar.app>',
        to: [inviteeEmail],
        subject: `${ownerName || 'Jemand'} hat dich zu Postklar eingeladen`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0">
            <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e0d8">
              <div style="width:44px;height:44px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:20px">✉</div>
              <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;color:#1a1916">Einladung zu Postklar</h1>
              <p style="font-size:14px;color:#5a5850;line-height:1.6;margin:0 0 16px">
                <strong style="color:#1a1916">${ownerName || 'Eine Person'}</strong> hat dich eingeladen, 
                ihre Post-Aufgaben in Postklar zu verfolgen.<br><br>
                Deine Berechtigung: <strong style="color:#1a1916">${permLabel}</strong>
              </p>
              <a href="${inviteUrl}" style="display:block;text-align:center;background:#2563eb;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:500;margin:24px 0">
                Einladung annehmen →
              </a>
              <p style="font-size:12px;color:#9a978e;margin:0">
                Oder diesen Link öffnen:<br>
                <a href="${inviteUrl}" style="color:#2563eb">${inviteUrl}</a>
              </p>
            </div>
          </div>
        `,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json()
      return res.status(resp.status).json({ error: err.message || 'Resend Fehler' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[/api/invite]', err)
    return res.status(500).json({ error: err.message })
  }
}
