// POST /api/notiz
// Fügt eine Notiz zu einem Dokument hinzu

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Session ungültig' })

  const { dokument_id, text, autor } = req.body
  if (!dokument_id || !text) return res.status(400).json({ error: 'Fehlende Parameter' })

  const { data: doc } = await supabaseAdmin
    .from('dokumente').select('notizen').eq('id', dokument_id).single()

  const notizen = doc?.notizen || []
  notizen.push({ text, autor: autor || 'Unbekannt', erstellt_am: new Date().toISOString() })

  const { error } = await supabaseAdmin
    .from('dokumente').update({ notizen }).eq('id', dokument_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true, notizen })
}
