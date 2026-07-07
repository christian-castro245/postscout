import { useState, useEffect } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Join() {
  const [token, setToken]         = useState(null)
  const [invite, setInvite]       = useState(null)   // { id, mitglied_email, inhaber_id }
  const [status, setStatus]       = useState('loading') // loading | valid | invalid | done | error
  const [mode, setMode]           = useState('login')   // login | register
  const [email, setEmail]         = useState('')
  const [pw, setPw]               = useState('')
  const [pw2, setPw2]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) { setStatus('invalid'); return }
    setToken(t)
    validateToken(t)
  }, [])

  async function validateToken(t) {
    const { data, error } = await supabase
      .from('familien_zugang')
      .select('id, mitglied_email, inhaber_id, aktiv')
      .eq('invite_token', t)
      .single()

    if (error || !data) { setStatus('invalid'); return }
    if (data.aktiv) { setStatus('done'); return }  // already accepted
    setInvite(data)
    if (data.mitglied_email) setEmail(data.mitglied_email)
    setStatus('valid')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !pw) return
    if (mode === 'register' && pw !== pw2) {
      setMsg({ text: 'Passwörter stimmen nicht überein', err: true }); return
    }
    setLoading(true); setMsg(null)

    try {
      let user

      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw new Error(error.message)
        user = data.user
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pw })
        if (error) throw new Error(error.message)
        user = data.user
        if (!user) throw new Error('Registrierung fehlgeschlagen — bitte E-Mail bestätigen')
      }

      // Link invite to user
      const { error: updateErr } = await supabase
        .from('familien_zugang')
        .update({ mitglied_id: user.id, aktiv: true, mitglied_email: email })
        .eq('id', invite.id)

      if (updateErr) throw new Error(updateErr.message)

      setStatus('done')
    } catch (err) {
      setMsg({ text: err.message, err: true })
    } finally {
      setLoading(false)
    }
  }

  const S = {
    wrap: {
      maxWidth: 430, margin: '0 auto', minHeight: '100vh',
      background: '#FBFAF8', fontFamily: '"Figtree",system-ui,-apple-system,sans-serif',
      color: '#1A1712', WebkitFontSmoothing: 'antialiased',
      display: 'flex', flexDirection: 'column',
    },
    header: {
      background: '#1F3A52', padding: '20px 20px 28px', textAlign: 'center',
    },
    logo: { fontSize: 28, marginBottom: 8 },
    title: { fontSize: 20, fontWeight: 700, color: '#fff' },
    sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
    body: { padding: '24px 20px', flex: 1 },
    card: { background: '#fff', borderRadius: 16, border: '1px solid #EFEDE6', padding: 20, marginBottom: 16 },
    label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B6B2A6', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '12px 14px', borderRadius: 11, border: '1.5px solid #E0DDD3', background: '#F4F2EC', color: '#1A1712', fontSize: 15, fontWeight: 500, fontFamily: 'inherit', outline: 'none', marginBottom: 12, boxSizing: 'border-box' },
    btn: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#1F3A52', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
    link: { display: 'block', textAlign: 'center', marginTop: 14, fontSize: 14, color: '#1F3A52', cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 },
    msgOk: { borderRadius: 11, padding: '10px 13px', fontSize: 13, fontWeight: 500, background: '#E9F0E9', color: '#2E7D46', marginBottom: 12 },
    msgErr: { borderRadius: 11, padding: '10px 13px', fontSize: 13, fontWeight: 500, background: '#FBEAE7', color: '#B3402C', marginBottom: 12 },
  }

  return (
    <>
      <Head>
        <title>Einladung annehmen – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      <div style={S.wrap}>
        <div style={S.header}>
          <div style={S.logo}>📬</div>
          <div style={S.title}>PostScout</div>
          <div style={S.sub}>Einladung annehmen</div>
        </div>

        <div style={S.body}>

          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: '#9A968B', marginTop: 40 }}>Wird geprüft…</div>
          )}

          {status === 'invalid' && (
            <div style={S.card}>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Ungültiger Link</div>
              <div style={{ fontSize: 14, color: '#7C786E', textAlign: 'center', lineHeight: 1.6 }}>
                Dieser Einladungslink ist nicht gültig oder bereits abgelaufen.<br/>
                Bitte fordere eine neue Einladung an.
              </div>
              <a href="/" style={{ ...S.btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>
                Zur Startseite
              </a>
            </div>
          )}

          {status === 'done' && (
            <div style={S.card}>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Einladung angenommen</div>
              <div style={{ fontSize: 14, color: '#7C786E', textAlign: 'center', lineHeight: 1.6 }}>
                Du hast Zugang zur geteilten Familienansicht.
              </div>
              <a href="/" style={{ ...S.btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>
                Zur App
              </a>
            </div>
          )}

          {status === 'valid' && (
            <div>
              <div style={{ ...S.card, background: '#EAF0F4', border: '1px solid #BBD0DE' }}>
                <div style={{ fontSize: 14, color: '#1F3A52', lineHeight: 1.6 }}>
                  Du wurdest zu PostScout eingeladen. Melde dich an oder erstelle ein Konto, um die Aufgaben deiner Familie zu sehen.
                </div>
              </div>

              <div style={S.card}>
                <div style={{ display: 'flex', gap: 0, background: '#F4F2EC', borderRadius: 11, padding: 3, marginBottom: 20 }}>
                  {['login', 'register'].map(m => (
                    <button key={m} onClick={() => { setMode(m); setMsg(null) }}
                      style={{ flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 13, fontWeight: mode===m?700:600, cursor: 'pointer', border: 'none', background: mode===m?'#fff':'transparent', color: mode===m?'#1A1712':'#9A968B', fontFamily: 'inherit', boxShadow: mode===m?'0 1px 3px rgba(0,0,0,0.08)':'none', transition: 'all 120ms' }}>
                      {m === 'login' ? 'Anmelden' : 'Konto erstellen'}
                    </button>
                  ))}
                </div>

                {msg && <div style={msg.err ? S.msgErr : S.msgOk}>{msg.text}</div>}

                <form onSubmit={handleSubmit}>
                  <label style={S.label}>E-Mail</label>
                  <input
                    style={S.input} type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="deine@email.de" required
                    autoComplete="email" autoCapitalize="none"
                  />
                  <label style={S.label}>Passwort</label>
                  <input
                    style={S.input} type="password" value={pw}
                    onChange={e => setPw(e.target.value)}
                    placeholder={mode === 'register' ? 'Mind. 6 Zeichen' : ''}
                    required autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                  {mode === 'register' && (
                    <>
                      <label style={S.label}>Passwort bestätigen</label>
                      <input
                        style={S.input} type="password" value={pw2}
                        onChange={e => setPw2(e.target.value)}
                        placeholder="Wiederholen" required
                        autoComplete="new-password"
                      />
                    </>
                  )}
                  <button type="submit" style={{ ...S.btn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                    disabled={loading}>
                    {loading ? 'Bitte warten…' : mode === 'login' ? 'Anmelden & beitreten' : 'Konto erstellen & beitreten'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #EDEBE4; }
        input, button, select { font-family: inherit; }
      `}</style>
    </>
  )
}
