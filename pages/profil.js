import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const IMAP_PROVIDERS = [
  { label: 'T-Online', host: 'secureimap.t-online.de' },
  { label: 'Gmail',    host: 'imap.gmail.com' },
  { label: 'iCloud',   host: 'imap.mail.me.com' },
  { label: 'GMX',      host: 'imap.gmx.net' },
  { label: 'Web.de',   host: 'imap.web.de' },
]

export default function Profil() {
  const [session, setSession]   = useState(null)
  const [activeSection, setActiveSection] = useState('person')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState(null)
  const [imapTesting, setImapTesting] = useState(false)

  // Flat state – no nested objects to avoid re-render focus loss
  const [vorname, setVorname]       = useState('')
  const [nachname, setNachname]     = useState('')
  const [strasse, setStrasse]       = useState('')
  const [hausnummer, setHausnummer] = useState('')
  const [plz, setPlz]               = useState('')
  const [ort, setOrt]               = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [telefon, setTelefon]       = useState('')
  const [steuerId, setSteuerId]     = useState('')
  const [bankName, setBankName]     = useState('')
  const [iban, setIban]             = useState('')
  const [bic, setBic]               = useState('')

  // IMAP
  const [imapHost, setImapHost]   = useState('secureimap.t-online.de')
  const [imapPort, setImapPort]   = useState(993)
  const [imapUser, setImapUser]   = useState('')
  const [imapPass, setImapPass]   = useState('')
  const [imapAktiv, setImapAktiv] = useState(true)
  const [imapSaved, setImapSaved] = useState(false)

  // Mieter
  const [mieter, setMieter]         = useState([])
  const [mVorname, setMVorname]     = useState('')
  const [mNachname, setMNachname]   = useState('')
  const [mEmail, setMEmail]         = useState('')
  const [mTelefon, setMTelefon]     = useState('')
  const [mStrasse, setMStrasse]     = useState('')
  const [mHausnummer, setMHausnummer] = useState('')
  const [mPlz, setMPlz]             = useState('')
  const [mOrt, setMOrt]             = useState('')
  const [mObjekt, setMObjekt]       = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfil(session.user.id)
        loadMieter(session.user.id)
        loadImap(session.user.id)
      }
    })
  }, [])

  async function loadProfil(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (!data) return
    setVorname(data.vorname || '')
    setNachname(data.nachname || '')
    setStrasse(data.strasse || '')
    setHausnummer(data.hausnummer || '')
    setPlz(data.plz || '')
    setOrt(data.ort || '')
    setGeburtsdatum(data.geburtsdatum || '')
    setTelefon(data.telefon || '')
    setSteuerId(data.steuer_id || '')
    setBankName(data.bank_name || '')
    setIban(data.iban || '')
    setBic(data.bic || '')
  }

  async function loadMieter(uid) {
    const { data } = await supabase.from('mieter').select('*').eq('user_id', uid).order('nachname')
    setMieter(data || [])
  }

  async function loadImap(uid) {
    const { data } = await supabase.from('imap_settings').select('*').eq('user_id', uid).single()
    if (!data) return
    setImapHost(data.host || 'secureimap.t-online.de')
    setImapPort(data.port || 993)
    setImapUser(data.username || '')
    setImapPass(data.password_encrypted || '')
    setImapAktiv(data.aktiv ?? true)
    setImapSaved(true)
  }

  async function saveProfil() {
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('profiles').update({
      vorname, nachname, strasse, hausnummer, plz, ort,
      geburtsdatum: geburtsdatum || null,
      telefon, steuer_id: steuerId,
      bank_name: bankName, iban, bic,
    }).eq('id', session.user.id)
    setMsg(error ? { text: error.message, err: true } : { text: 'Gespeichert ✓', err: false })
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  async function saveImap() {
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('imap_settings').upsert({
      user_id: session.user.id,
      host: imapHost, port: imapPort,
      username: imapUser, password_encrypted: imapPass,
      aktiv: imapAktiv,
    }, { onConflict: 'user_id' })
    if (!error) { setImapSaved(true); setMsg({ text: 'IMAP gespeichert ✓', err: false }) }
    else setMsg({ text: error.message, err: true })
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  async function testImap() {
    setImapTesting(true); setMsg(null)
    const res = await fetch('/api/imap-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: imapHost, port: imapPort, username: imapUser, password_encrypted: imapPass }),
    })
    const data = await res.json()
    setMsg(data.ok
      ? { text: `✓ Verbunden – ${data.count} ungelesene Mails`, err: false }
      : { text: 'Fehler: ' + data.error, err: true }
    )
    setImapTesting(false)
  }

  async function addMieter() {
    if (!mVorname || !mNachname) return
    const { error } = await supabase.from('mieter').insert({
      user_id: session.user.id,
      vorname: mVorname, nachname: mNachname,
      email: mEmail, telefon: mTelefon,
      strasse: mStrasse, hausnummer: mHausnummer,
      plz: mPlz, ort: mOrt, objekt_bezeichnung: mObjekt,
    })
    if (!error) {
      setMVorname(''); setMNachname(''); setMEmail(''); setMTelefon('')
      setMStrasse(''); setMHausnummer(''); setMPlz(''); setMOrt(''); setMObjekt('')
      loadMieter(session.user.id)
      setMsg({ text: 'Mieter gespeichert ✓', err: false })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function deleteMieter(id) {
    if (!confirm('Mieter wirklich löschen?')) return
    await supabase.from('mieter').delete().eq('id', id)
    loadMieter(session.user.id)
  }

  // Telefon: nur + und Zahlen
  function handleTelefon(val, setter) {
    setter(val.replace(/[^\d+\s\-()]/g, ''))
  }

  const sections = [
    { id: 'person', label: '👤 Person' },
    { id: 'bank',   label: '🏦 Bank' },
    { id: 'mieter', label: '🏠 Mieter' },
    { id: 'imap',   label: '📧 E-Mail' },
  ]

  const s = { // shared input style
    width: '100%', padding: '11px 13px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', background: '#fff',
    color: '#0A1628', fontSize: 15, fontFamily: 'inherit',
    WebkitAppearance: 'none', appearance: 'none',
  }

  const label = { // shared label style
    fontSize: 12, fontWeight: 700, color: '#6B7280',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <>
      <Head>
        <title>Profil – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ maxWidth: 460, margin: '0 auto', minHeight: '100vh', background: '#F4F6FA', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>

        {/* Navy header */}
        <div style={{ background: '#0A1628', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
          <a href="/" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 500 }}>‹ Zurück</a>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Mein Profil</span>
        </div>

        <div style={{ padding: '1.25rem 1rem 5rem' }}>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: '#E5E7EB', borderRadius: 12, padding: 3 }}>
            {sections.map(sec => (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                style={{ flex: 1, padding: '8px 2px', borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  background: activeSection === sec.id ? '#fff' : 'transparent',
                  color: activeSection === sec.id ? '#0A1628' : '#6B7280',
                  boxShadow: activeSection === sec.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {sec.label}
              </button>
            ))}
          </div>

          {msg && (
            <div style={{ borderRadius: 10, padding: '11px 14px', fontSize: 13, marginBottom: 14, fontWeight: 500,
              background: msg.err ? '#FEF2F2' : '#F0FDF4',
              color: msg.err ? '#B91C1C' : '#15803D',
              border: `1px solid ${msg.err ? '#FECACA' : '#BBF7D0'}`,
            }}>{msg.text}</div>
          )}

          {/* ── PERSON ── */}
          {activeSection === 'person' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628', marginBottom: 16 }}>Persönliche Daten</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={label}>Vorname</label>
                  <input style={s} type="text" autoComplete="given-name" value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Max" />
                </div>
                <div>
                  <label style={label}>Nachname</label>
                  <input style={s} type="text" autoComplete="family-name" value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Mustermann" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={label}>Straße</label>
                  <input style={s} type="text" autoComplete="street-address" value={strasse} onChange={e => setStrasse(e.target.value)} placeholder="Musterstraße" />
                </div>
                <div>
                  <label style={label}>Nr.</label>
                  <input style={s} type="text" value={hausnummer} onChange={e => setHausnummer(e.target.value)} placeholder="1a" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={label}>PLZ</label>
                  <input style={s} type="text" autoComplete="postal-code" inputMode="numeric" value={plz} onChange={e => setPlz(e.target.value)} placeholder="12345" />
                </div>
                <div>
                  <label style={label}>Ort</label>
                  <input style={s} type="text" autoComplete="address-level2" value={ort} onChange={e => setOrt(e.target.value)} placeholder="Berlin" />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>Geburtsdatum</label>
                <input style={s} type="date" autoComplete="bday" value={geburtsdatum} onChange={e => setGeburtsdatum(e.target.value)} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>Telefon</label>
                <input style={s} type="tel" autoComplete="tel" inputMode="tel" value={telefon}
                  onChange={e => handleTelefon(e.target.value, setTelefon)} placeholder="+49 151 12345678" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={label}>Steuer-ID</label>
                <input style={s} type="text" inputMode="numeric" value={steuerId} onChange={e => setSteuerId(e.target.value)} placeholder="11-stellige Steuer-ID" />
              </div>

              <button onClick={saveProfil} disabled={saving}
                style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', background: '#0A1628', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          )}

          {/* ── BANK ── */}
          {activeSection === 'bank' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628', marginBottom: 16 }}>Bankverbindung</div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>Bank / Institut</label>
                <input style={s} type="text" autoComplete="organization" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Deutsche Bank" />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>IBAN</label>
                <input style={s} type="text" autoComplete="off" value={iban} onChange={e => setIban(e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={label}>BIC</label>
                <input style={s} type="text" autoComplete="off" value={bic} onChange={e => setBic(e.target.value)} placeholder="DEUTDEDB" />
              </div>

              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                ⚠️ Diese Daten werden ausschließlich für Anschreiben-Vorlagen genutzt und nicht weitergegeben.
              </div>

              <button onClick={saveProfil} disabled={saving}
                style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', background: '#0A1628', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          )}

          {/* ── MIETER ── */}
          {activeSection === 'mieter' && (
            <div>
              {mieter.map(m => (
                <div key={m.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0A1628' }}>{m.vorname} {m.nachname}</div>
                      {m.objekt_bezeichnung && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>🏠 {m.objekt_bezeichnung}</div>}
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{m.strasse} {m.hausnummer}, {m.plz} {m.ort}</div>
                      {m.email && <div style={{ fontSize: 12, color: '#0A1628', marginTop: 2 }}>✉ {m.email}</div>}
                      {m.telefon && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>📞 {m.telefon}</div>}
                    </div>
                    <button onClick={() => deleteMieter(m.id)}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 13, color: '#B91C1C' }}>✕</button>
                  </div>
                </div>
              ))}

              <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628', marginBottom: 14 }}>Mieter hinzufügen</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Vorname *</label>
                    <input style={s} type="text" autoComplete="given-name" value={mVorname} onChange={e => setMVorname(e.target.value)} placeholder="Max" />
                  </div>
                  <div>
                    <label style={label}>Nachname *</label>
                    <input style={s} type="text" autoComplete="family-name" value={mNachname} onChange={e => setMNachname(e.target.value)} placeholder="Muster" />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={label}>Objekt / Wohnung</label>
                  <input style={s} type="text" value={mObjekt} onChange={e => setMObjekt(e.target.value)} placeholder="z.B. EG links, Musterstr. 1" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>Straße</label>
                    <input style={s} type="text" autoComplete="street-address" value={mStrasse} onChange={e => setMStrasse(e.target.value)} placeholder="Musterstraße" />
                  </div>
                  <div>
                    <label style={label}>Nr.</label>
                    <input style={s} type="text" value={mHausnummer} onChange={e => setMHausnummer(e.target.value)} placeholder="1a" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={label}>PLZ</label>
                    <input style={s} type="text" autoComplete="postal-code" inputMode="numeric" value={mPlz} onChange={e => setMPlz(e.target.value)} placeholder="12345" />
                  </div>
                  <div>
                    <label style={label}>Ort</label>
                    <input style={s} type="text" autoComplete="address-level2" value={mOrt} onChange={e => setMOrt(e.target.value)} placeholder="Berlin" />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={label}>E-Mail</label>
                  <input style={s} type="email" autoComplete="email" inputMode="email" value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="mieter@beispiel.de" />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={label}>Telefon</label>
                  <input style={s} type="tel" autoComplete="tel" inputMode="tel" value={mTelefon}
                    onChange={e => handleTelefon(e.target.value, setMTelefon)} placeholder="+49 151 12345678" />
                </div>

                <button onClick={addMieter} disabled={!mVorname || !mNachname}
                  style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', background: '#0A1628', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: (!mVorname || !mNachname) ? 0.4 : 1 }}>
                  Mieter hinzufügen
                </button>
              </div>
            </div>
          )}

          {/* ── IMAP ── */}
          {activeSection === 'imap' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628', marginBottom: 6 }}>E-Mail Postfach verbinden</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
                PostScout liest täglich neue Mails automatisch – Anhänge werden ebenfalls gespeichert.
              </div>

              {/* Provider quickselect */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {IMAP_PROVIDERS.map(p => (
                  <button key={p.host} onClick={() => setImapHost(p.host)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: imapHost === p.host ? '#0A1628' : '#fff',
                      color: imapHost === p.host ? '#fff' : '#374151',
                      borderColor: imapHost === p.host ? '#0A1628' : '#E5E7EB',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>IMAP Server</label>
                <input style={s} type="text" autoCapitalize="none" autoCorrect="off" value={imapHost} onChange={e => setImapHost(e.target.value)} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>E-Mail Adresse</label>
                <input style={s} type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder="deine@email.de" />
              </div>

              <div style={{ marginBottom: 6 }}>
                <label style={label}>App-Passwort</label>
                <input style={s} type="password" autoComplete="current-password" value={imapPass} onChange={e => setImapPass(e.target.value)} placeholder="App-Passwort (nicht dein normales)" />
              </div>

              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16, lineHeight: 1.6, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                💡 <strong>T-Online:</strong> mein.t-online.de → Sicherheit → App-Passwörter<br />
                💡 <strong>Gmail:</strong> Google-Konto → Sicherheit → 2FA → App-Passwörter
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: imapSaved ? 12 : 0 }}>
                <button onClick={testImap} disabled={imapTesting || !imapUser || !imapPass}
                  style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', color: '#0A1628', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!imapUser || !imapPass) ? 0.4 : 1 }}>
                  {imapTesting ? 'Teste…' : 'Verbindung testen'}
                </button>
                <button onClick={saveImap} disabled={saving || !imapUser || !imapPass}
                  style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#0A1628', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!imapUser || !imapPass || saving) ? 0.4 : 1 }}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>

              {imapSaved && (
                <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, color: '#15803D', fontWeight: 500 }}>
                  ✓ IMAP verbunden – PostScout synct täglich automatisch
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
