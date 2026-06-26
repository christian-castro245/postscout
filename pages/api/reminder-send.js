// POST /api/reminder-send  (called by Vercel Cron or manually)
// Checks all users with reminder settings and sends due emails

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Verify cron secret to prevent abuse
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const resendKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://postscout-beige.vercel.app'
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY fehlt' })

  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentDay = now.getDay() // 0=So, 1=Mo...
  const todayStr = now.toISOString().split('T')[0]

  // Load all reminder settings
  const { data: settings, error } = await supabaseAdmin
    .from('reminder_settings')
    .select('*, profiles(id, name)')

  if (error) return res.status(500).json({ error: error.message })

  let sent = 0

  for (const s of settings || []) {
    // Check if this user should get a reminder now
    const shouldSend = shouldSendNow(s, currentHour, currentDay)
    if (!shouldSend) continue

    // Get user's open todos
    const { data: docs } = await supabaseAdmin
      .from('dokumente')
      .select('absender, dateiname, dringlichkeit, todos, frist, kategorie')
      .eq('user_id', s.user_id)

    const allTodos = []
    ;(docs || []).forEach(doc => {
      ;(doc.todos || []).filter(t => !t.erledigt).forEach(t => {
        allTodos.push({
          aufgabe: t.aufgabe,
          frist: t.frist,
          dringlichkeit: t.dringlichkeit || doc.dringlichkeit || 'niedrig',
          dokument: doc.absender || doc.dateiname,
        })
      })
    })

    // Filter based on preference
    const todosToShow = s.nur_dringende
      ? allTodos.filter(t => t.dringlichkeit === 'hoch' || (t.frist && new Date(t.frist) <= new Date(Date.now() + 7 * 86400000)))
      : allTodos

    if (!todosToShow.length) continue

    // Sort by urgency + date
    todosToShow.sort((a, b) => {
      const order = { hoch: 0, mittel: 1, niedrig: 2 }
      if (order[a.dringlichkeit] !== order[b.dringlichkeit]) return order[a.dringlichkeit] - order[b.dringlichkeit]
      if (a.frist && b.frist) return new Date(a.frist) - new Date(b.frist)
      return 0
    })

    // Get user email
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(s.user_id)
    if (!user?.email) continue

    const todoRows = todosToShow.map(t => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0efe9;font-size:13px;color:#1a1916">${t.aufgabe}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0efe9;font-size:12px;color:#5a5850">${t.dokument}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0efe9;font-size:12px;text-align:right">
          <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;${
            t.dringlichkeit==='hoch' ? 'background:#fef2f2;color:#991b1b' :
            t.dringlichkeit==='mittel' ? 'background:#fffbeb;color:#92400e' :
            'background:#f0fdf4;color:#15803d'
          }">${t.dringlichkeit==='hoch'?'Dringend':t.dringlichkeit==='mittel'?'Mittelfristig':'Kein Zeitdruck'}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0efe9;font-size:12px;color:#9a978e;text-align:right">${t.frist ? new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE') : '–'}</td>
      </tr>`).join('')

    const emailHtml = `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f5f4f0">
        <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e0d8">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="width:36px;height:36px;background:#2563eb;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px">✉</div>
            <div>
              <div style="font-size:17px;font-weight:600;color:#1a1916">PostScout Aufgaben</div>
              <div style="font-size:12px;color:#9a978e">${todayStr}</div>
            </div>
          </div>
          <p style="font-size:14px;color:#5a5850;margin:0 0 20px">
            Du hast <strong style="color:#1a1916">${todosToShow.length} offene Aufgabe${todosToShow.length!==1?'n':''}</strong>${s.nur_dringende?' (zeitkritisch)':''}.
          </p>
          <table style="width:100%;border-collapse:collapse;font-family:-apple-system,sans-serif">
            <thead>
              <tr style="background:#f5f4f0">
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#9a978e;letter-spacing:0.05em;text-transform:uppercase">Aufgabe</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#9a978e;letter-spacing:0.05em;text-transform:uppercase">Dokument</th>
                <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#9a978e;letter-spacing:0.05em;text-transform:uppercase">Status</th>
                <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#9a978e;letter-spacing:0.05em;text-transform:uppercase">Frist</th>
              </tr>
            </thead>
            <tbody>${todoRows}</tbody>
          </table>
          <div style="margin-top:24px;text-align:center">
            <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:500">
              Aufgaben öffnen →
            </a>
          </div>
          <p style="font-size:11px;color:#9a978e;margin:20px 0 0;text-align:center">
            <a href="${appUrl}/settings" style="color:#9a978e">Reminder-Einstellungen ändern</a>
          </p>
        </div>
      </div>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'PostScout <noreply@postscout.app>',
        to: [user.email],
        subject: `${todosToShow.filter(t=>t.dringlichkeit==='hoch').length > 0 ? '⚡ ' : ''}${todosToShow.length} offene Aufgabe${todosToShow.length!==1?'n':''} – PostScout`,
        html: emailHtml,
      }),
    })
    sent++
  }

  return res.status(200).json({ ok: true, sent })
}

function shouldSendNow(s, currentHour, currentDay) {
  // Check hour matches (UTC-based, simple)
  const preferredHour = s.uhrzeit_utc ?? 7
  if (currentHour !== preferredHour) return false

  // Check frequency
  switch (s.frequenz) {
    case 'taeglich': return true
    case '2x_woche': return [1, 4].includes(currentDay) // Mo + Do
    case 'woechentlich': return currentDay === 1 // Mo
    default: return false
  }
}
