// POST /api/scan-only-save
// Speichert ein Dokument das über den Scan-Only-Modus aufgenommen wurde
// Validiert den scan_token und speichert im Account des Inhabers

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST' })

  const { scanToken, ownerId, storagePath, analysisResult: r, pageCount } = req.body

  // Validate token
  const { data: token, error: tokenErr } = await supabaseAdmin
    .from('scan_tokens')
    .select('inhaber_id, aktiv')
    .eq('token', scanToken)
    .eq('inhaber_id', ownerId)
    .single()

  if (tokenErr || !token || !token.aktiv) {
    return res.status(401).json({ error: 'Ungültiger Scan-Token' })
  }

  function parseFrist(frist) {
    if (!frist) return null
    const p = frist.split('.')
    if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`
    return null
  }

  const { error: dbErr } = await supabaseAdmin.from('dokumente').insert({
    user_id: ownerId,
    dateiname: `Scan (${pageCount} Seite${pageCount !== 1 ? 'n' : ''})`,
    storage_path: storagePath,
    mime_type: 'image/jpeg',
    quelle: 'scan-only',
    anhaenge: [],
    notizen: [],
    kategorie: r.kategorie,
    absender: r.absender,
    zusammenfassung: r.zusammenfassung,
    dringlichkeit: r.dringlichkeit,
    frist: parseFrist(r.frist),
    betrag: r.betrag,
    steuerrelevant: r.steuerrelevant,
    jahr: new Date().getFullYear(),
    todos: (r.todos || []).map(t => ({ ...t, status: 'offen', dringlichkeit: t.dringlichkeit || r.dringlichkeit })),
    empfehlungen: r.empfehlungen || [],
    inhalts_hash: r.inhaltsHash || null,
  })

  if (dbErr) return res.status(500).json({ error: dbErr.message })
  return res.status(200).json({ ok: true })
}
