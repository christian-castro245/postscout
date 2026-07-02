import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const IMAP_PROVIDERS = [
  { label: 'T-Online', host: 'secureimap.t-online.de' },
  { label: 'Gmail',    host: 'imap.gmail.com' },
  { label: 'iCloud',   host: 'imap.mail.me.com' },
  { label: 'GMX',      host: 'imap.gmx.net' },
  { label: 'Web.de',   host: 'imap.web.de' },
]

const KONTAKT_KATEGORIEN = ['Arzt', 'Anwalt', 'Steuerberater', 'Hausmeister', 'Nachbar', 'Behörde', 'Handwerker', 'Sonstiges']

const TABS = [
  { id: 'person',    label: 'Person' },
  { id: 'bank',      label: 'Bank' },
  { id: 'mieter',    label: 'Mieter' },
  { id: 'kontakte',  label: 'Kontakte' },
  { id: 'imap',      label: 'E-Mail' },
  { id: 'freigaben', label: 'Freigaben' },
]

const PERM_OPTS = [
  { value: 'lesen',   label: 'Nur lesen' },
  { value: 'abhaken', label: 'Lesen + Abhaken' },
  { value: 'notizen', label: 'Lesen + Abhaken + Notizen' },
]

function randomToken() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }

// ── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)
const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
  </svg>
)
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
  </svg>
)

// ── Reusable Field ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type='text', placeholder='', autoComplete, autoCapitalize, autoCorrect, inputMode, hint }) {
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#B6B2A6',display:'block',marginBottom:6}}>{label}</label>
      <input
        type={type} value={value||''} placeholder={placeholder}
        autoComplete={autoComplete} autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect} inputMode={inputMode}
        onChange={e => onChange(e.target.value)}
        style={{width:'100%',padding:'11px 13px',borderRadius:11,border:'1.5px solid #E0DDD3',background:'#F4F2EC',color:'#1A1712',fontSize:15,fontWeight:500,fontFamily:'inherit',outline:'none',transition:'border-color 150ms,background 150ms'}}
        onFocus={e=>{e.target.style.borderColor='#1F3A52';e.target.style.background='#fff'}}
        onBlur={e=>{e.target.style.borderColor='#E0DDD3';e.target.style.background='#F4F2EC'}}
      />
      {hint && <div style={{fontSize:12,color:'#9A968B',marginTop:4}}>{hint}</div>}
    </div>
  )
}

function Row({ children, cols='1fr 1fr' }) {
  return <div style={{display:'grid',gridTemplateColumns:cols,gap:10}}>{children}</div>
}

function Card({ children, style={} }) {
  return (
    <div style={{background:'#fff',borderRadius:16,border:'1px solid #EFEDE6',padding:16,marginBottom:12,...style}}>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#B6B2A6',marginBottom:10}}>{children}</div>
}

function PrimaryBtn({ onClick, loading, disabled, children, fullWidth=true, icon }) {
  return (
    <button onClick={onClick} disabled={loading||disabled}
      style={{width:fullWidth?'100%':'auto',display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'13px 18px',borderRadius:14,border:'none',background:'#1F3A52',color:'#fff',fontSize:15,fontWeight:600,cursor:(loading||disabled)?'not-allowed':'pointer',opacity:(loading||disabled)?0.45:1,fontFamily:'inherit',transition:'background 120ms'}}>
      {icon && !loading && icon}
      {loading ? 'Speichern…' : children}
    </button>
  )
}

function NoteBox({ children }) {
  return (
    <div style={{fontSize:12,color:'#7C786E',background:'#F4F2EC',borderRadius:11,padding:'10px 12px',lineHeight:1.6,marginBottom:16}}>
      {children}
    </div>
  )
}

export default function Profil() {
  const [session, setSession]     = useState(null)
  const [activeTab, setActiveTab] = useState('person')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState(null)
  const [imapTesting, setImapTesting] = useState(false)

  // Person
  const [anrede, setAnrede]             = useState('du')
  const [vorname, setVorname]           = useState('')
  const [nachname, setNachname]         = useState('')
  const [strasse, setStrasse]           = useState('')
  const [hausnummer, setHausnummer]     = useState('')
  const [plz, setPlz]                   = useState('')
  const [ort, setOrt]                   = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [telefon, setTelefon]           = useState('')
  const [steuerId, setSteuerId]         = useState('')

  // Bank
  const [bankName, setBankName] = useState('')
  const [iban, setIban]         = useState('')
  const [bic, setBic]           = useState('')

  // IMAP
  const [imapHost, setImapHost] = useState('secureimap.t-online.de')
  const [imapPort, setImapPort] = useState(993)
  const [imapUser, setImapUser] = useState('')
  const [imapPass, setImapPass] = useState('')
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

  // Freigaben
  const [familyMembers, setFamilyMembers]   = useState([])
  const [inviteEmail, setInviteEmail]       = useState('')
  const [invitePerm, setInvitePerm]         = useState('abhaken')
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [inviteMsg, setInviteMsg]           = useState(null)
  const [qrToken, setQrToken]               = useState(null)
  const [showQr, setShowQr]                 = useState(false)
  const [scanTokenUrl, setScanTokenUrl]     = useState(null)
  const [scanTokenLoading, setScanTokenLoading] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Kontakte
  const [kontakte, setKontakte] = useState([])
  const [kKat, setKKat]         = useState('Arzt')
  const [kName, setKName]       = useState('')
  const [kOrg, setKOrg]         = useState('')
  const [kEmail, setKEmail]     = useState('')
  const [kTelefon, setKTelefon] = useState('')
  const [kNotiz, setKNotiz]     = useState('')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && TABS.find(t => t.id === hash)) setActiveTab(hash)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfil(session.user.id)
        loadMieter(session.user.id)
        loadImap(session.user.id)
        loadKontakte(session.user.id)
        loadFamilyMembers(session.user.id)
        loadScanToken(session.user.id)
      }
    })
  }, [])

  async function loadProfil(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (!data) return
    setAnrede(data.anrede||'du')
    setVorname(data.vorname||''); setNachname(data.nachname||'')
    setStrasse(data.strasse||''); setHausnummer(data.hausnummer||'')
    setPlz(data.plz||''); setOrt(data.ort||'')
    setGeburtsdatum(data.geburtsdatum||''); setTelefon(data.telefon||'')
    setSteuerId(data.steuer_id||''); setBankName(data.bank_name||'')
    setIban(data.iban||''); setBic(data.bic||'')
  }
  async function loadFamilyMembers(uid) {
    const { data } = await supabase.from('familien_zugang')
      .select('id,mitglied_email,berechtigung,aktiv,erstellt_am')
      .eq('inhaber_id', uid).order('erstellt_am', { ascending: false })
    setFamilyMembers(data || [])
  }
  async function loadScanToken(uid) {
    const { data } = await supabase.from('scan_tokens')
      .select('token').eq('inhaber_id', uid).eq('aktiv', true).single()
    if (data) setScanTokenUrl(`${appUrl}/scan-only?token=${data.token}`)
  }
  async function loadMieter(uid) {
    const { data } = await supabase.from('mieter').select('*').eq('user_id', uid).order('nachname')
    setMieter(data||[])
  }
  async function loadImap(uid) {
    const { data } = await supabase.from('imap_settings').select('*').eq('user_id', uid).single()
    if (!data) return
    setImapHost(data.host||'secureimap.t-online.de'); setImapPort(data.port||993)
    setImapUser(data.username||''); setImapPass(data.password_encrypted||'')
    setImapSaved(true)
  }
  async function loadKontakte(uid) {
    const { data } = await supabase.from('kontakte').select('*').eq('user_id', uid).order('name')
    setKontakte(data||[])
  }

  function showMsg(text, err=false) {
    setMsg({ text, err }); setTimeout(() => setMsg(null), 3000)
  }

  async function saveProfil() {
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      anrede, vorname, nachname, strasse, hausnummer, plz, ort,
      geburtsdatum: geburtsdatum||null, telefon,
      steuer_id: steuerId, bank_name: bankName, iban, bic,
    }, { onConflict: 'id' })
    showMsg(error ? error.message : 'Gespeichert', !!error)
    setSaving(false)
  }

  async function sendInvite() {
    setInviteLoading(true); setInviteMsg(null)
    const token = randomToken() + randomToken()
    const { error } = await supabase.from('familien_zugang').insert({
      inhaber_id: session.user.id, mitglied_email: inviteEmail,
      berechtigung: invitePerm, aktiv: false, einladungs_token: token,
    })
    if (error) { setInviteMsg({ text: error.message, err: true }); setInviteLoading(false); return }
    const ownerName = [vorname, nachname].filter(Boolean).join(' ') || session.user.email
    await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteeEmail: inviteEmail, ownerName, permission: invitePerm, inviteToken: token }),
    })
    setInviteMsg({ text: 'Einladungs-E-Mail gesendet!', err: false })
    setInviteEmail('')
    loadFamilyMembers(session.user.id)
    setInviteLoading(false)
  }

  async function generateQR() {
    const token = randomToken() + randomToken()
    const { error } = await supabase.from('familien_zugang').insert({
      inhaber_id: session.user.id, mitglied_email: null, berechtigung: invitePerm,
      aktiv: false, einladungs_token: token,
    })
    if (!error) { setQrToken(`${appUrl}/join?token=${token}`); setShowQr(true) }
  }

  async function updatePermission(id, berechtigung) {
    await supabase.from('familien_zugang').update({ berechtigung }).eq('id', id)
    loadFamilyMembers(session.user.id)
  }

  async function revokeAccess(id) {
    if (!confirm('Zugang wirklich entziehen?')) return
    await supabase.from('familien_zugang').delete().eq('id', id)
    loadFamilyMembers(session.user.id)
  }

  async function generateScanToken() {
    setScanTokenLoading(true)
    const token = randomToken() + randomToken()
    await supabase.from('scan_tokens').insert({ inhaber_id: session.user.id, token, label: 'Scan-Link', aktiv: true })
    setScanTokenUrl(`${appUrl}/scan-only?token=${token}`)
    setScanTokenLoading(false)
  }

  async function deactivateScanToken() {
    if (!confirm('Scan-Link wirklich deaktivieren?')) return
    await supabase.from('scan_tokens').update({ aktiv: false }).eq('inhaber_id', session.user.id)
    setScanTokenUrl(null)
  }

  async function saveImap() {
    setSaving(true)
    const { error } = await supabase.from('imap_settings').upsert({
      user_id: session.user.id, host: imapHost, port: imapPort,
      username: imapUser, password_encrypted: imapPass, aktiv: true,
    }, { onConflict: 'user_id' })
    if (!error) { setImapSaved(true); showMsg('IMAP gespeichert') }
    else showMsg(error.message, true)
    setSaving(false)
  }

  async function testImap() {
    setImapTesting(true)
    const res = await fetch('/api/imap-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: imapHost, port: imapPort, username: imapUser, password_encrypted: imapPass }),
    })
    const data = await res.json()
    showMsg(data.ok ? `Verbunden — ${data.count} ungelesene Mails` : 'Fehler: ' + data.error, !data.ok)
    setImapTesting(false)
  }

  async function addMieter() {
    if (!mVorname || !mNachname) return
    const { error } = await supabase.from('mieter').insert({
      user_id: session.user.id, vorname: mVorname, nachname: mNachname,
      email: mEmail, telefon: mTelefon, strasse: mStrasse, hausnummer: mHausnummer,
      plz: mPlz, ort: mOrt, objekt_bezeichnung: mObjekt,
    })
    if (!error) {
      setMVorname(''); setMNachname(''); setMEmail(''); setMTelefon('')
      setMStrasse(''); setMHausnummer(''); setMPlz(''); setMOrt(''); setMObjekt('')
      loadMieter(session.user.id); showMsg('Mieter gespeichert')
    }
  }
  async function deleteMieter(id) {
    if (!confirm('Mieter wirklich löschen?')) return
    await supabase.from('mieter').delete().eq('id', id); loadMieter(session.user.id)
  }

  async function addKontakt() {
    if (!kName) return
    const { error } = await supabase.from('kontakte').insert({
      user_id: session.user.id, kategorie: kKat, name: kName,
      organisation: kOrg, email: kEmail, telefon: kTelefon, notiz: kNotiz,
    })
    if (!error) {
      setKName(''); setKOrg(''); setKEmail(''); setKTelefon(''); setKNotiz('')
      loadKontakte(session.user.id); showMsg('Kontakt gespeichert')
    }
  }
  async function deleteKontakt(id) {
    if (!confirm('Kontakt wirklich löschen?')) return
    await supabase.from('kontakte').delete().eq('id', id); loadKontakte(session.user.id)
  }

  function handleTel(val, setter) { setter(val.replace(/[^\d+\s\-()+]/g,'')) }

  const initials = `${vorname?.[0]||''}${nachname?.[0]||''}`.toUpperCase() || '?'
  const fullName = [vorname, nachname].filter(Boolean).join(' ') || 'Mein Profil'
  const userEmail = session?.user?.email || ''

  return (
    <>
      <Head>
        <title>Profil – PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{maxWidth:430,margin:'0 auto',minHeight:'100vh',background:'#FBFAF8',fontFamily:'"Figtree",system-ui,-apple-system,sans-serif',color:'#1A1712',WebkitFontSmoothing:'antialiased'}}>

        {/* ── HEADER ── */}
        <header style={{background:'#1F3A52',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
          <a href="/" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',color:'#FBFAF8',textDecoration:'none',flexShrink:0}}>
            <BackIcon/>
          </a>
          <span style={{fontSize:16,fontWeight:700,color:'#fff',letterSpacing:'-0.3px'}}>Mein Profil</span>
          <div style={{width:34}}/>
        </header>

        {/* ── AVATAR HERO ── */}
        <div style={{background:'#1F3A52',padding:'0 20px 28px',borderRadius:'0 0 30px 30px',textAlign:'center'}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'2px solid rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:700,color:'#fff',margin:'0 auto 10px'}}>
            {initials}
          </div>
          <div style={{fontSize:16,fontWeight:700,color:'#fff'}}>{fullName}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:3}}>{userEmail}</div>
        </div>

        <div style={{padding:'16px 20px 60px'}}>

          {/* ── TAB BAR ── */}
          <div style={{display:'flex',gap:0,background:'#F4F2EC',borderRadius:11,padding:3,marginBottom:20,overflowX:'auto'}}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{flex:1,padding:'7px 6px',borderRadius:9,fontSize:12,fontWeight:activeTab===t.id?700:600,cursor:'pointer',border:'none',background:activeTab===t.id?'#fff':'transparent',color:activeTab===t.id?'#1A1712':'#9A968B',whiteSpace:'nowrap',fontFamily:'inherit',boxShadow:activeTab===t.id?'0 1px 3px rgba(0,0,0,0.08)':'none',transition:'all 120ms'}}>
                {t.label}
              </button>
            ))}
          </div>

          {msg && (
            <div style={{borderRadius:11,padding:'10px 13px',fontSize:13,marginBottom:12,fontWeight:500,background:msg.err?'#FBEAE7':'#E9F0E9',color:msg.err?'#B3402C':'#2E7D46',border:`1px solid ${msg.err?'#f5c0b6':'#b8d9c0'}`}}>
              {msg.text}
            </div>
          )}

          {/* ── PERSON ── */}
          {activeTab === 'person' && (
            <div>
              <Card>
                <SectionLabel>Persönliche Daten</SectionLabel>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#B6B2A6',display:'block',marginBottom:8}}>Anrede</label>
                  <div style={{display:'flex',gap:6}}>
                    {['du','Herr','Frau'].map(opt => (
                      <button key={opt} onClick={() => setAnrede(opt)}
                        style={{flex:1,padding:'9px 6px',borderRadius:11,border:`1.5px solid ${anrede===opt?'#1F3A52':'#E0DDD3'}`,background:anrede===opt?'#1F3A52':'#F4F2EC',color:anrede===opt?'#fff':'#7C786E',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 120ms'}}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <Row>
                  <Field label="Vorname" value={vorname} onChange={setVorname} autoComplete="given-name" placeholder="Max"/>
                  <Field label="Nachname" value={nachname} onChange={setNachname} autoComplete="family-name" placeholder="Mustermann"/>
                </Row>
                <Row cols="2fr 1fr">
                  <Field label="Straße" value={strasse} onChange={setStrasse} autoComplete="street-address" placeholder="Musterstraße"/>
                  <Field label="Nr." value={hausnummer} onChange={setHausnummer} placeholder="1a"/>
                </Row>
                <Row cols="1fr 2fr">
                  <Field label="PLZ" value={plz} onChange={setPlz} autoComplete="postal-code" inputMode="numeric" placeholder="12345"/>
                  <Field label="Ort" value={ort} onChange={setOrt} autoComplete="address-level2" placeholder="Berlin"/>
                </Row>
                <Field label="Geburtsdatum" type="date" value={geburtsdatum} onChange={setGeburtsdatum} autoComplete="bday"/>
                <Field label="Telefon" type="tel" value={telefon} onChange={v => handleTel(v, setTelefon)} autoComplete="tel" inputMode="tel" placeholder="+49 151 …"/>
                <Field label="Steuer-ID" value={steuerId} onChange={setSteuerId} inputMode="numeric" placeholder="11-stellige Steuer-ID"/>
                <PrimaryBtn onClick={saveProfil} loading={saving} icon={<SaveIcon/>}>Speichern</PrimaryBtn>
              </Card>
            </div>
          )}

          {/* ── BANK ── */}
          {activeTab === 'bank' && (
            <div>
              <Card>
                <SectionLabel>Bankverbindung</SectionLabel>
                <Field label="Bank / Institut" value={bankName} onChange={setBankName} autoComplete="organization" placeholder="Sparkasse Berlin"/>
                <Field label="IBAN" value={iban} onChange={setIban} autoComplete="off" placeholder="DE00 0000 0000 0000 0000 00"/>
                <Field label="BIC" value={bic} onChange={setBic} autoComplete="off" placeholder="DEUTDEDB"/>
                <NoteBox>Wird ausschließlich für Anschreiben-Vorlagen verwendet und nicht weitergegeben.</NoteBox>
                <PrimaryBtn onClick={saveProfil} loading={saving} icon={<SaveIcon/>}>Speichern</PrimaryBtn>
              </Card>
            </div>
          )}

          {/* ── MIETER ── */}
          {activeTab === 'mieter' && (
            <div>
              {mieter.length > 0 && (
                <div style={{marginBottom:4}}>
                  <SectionLabel>Aktuell eingetragen</SectionLabel>
                  {mieter.map(m => (
                    <Card key={m.id}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                        <div style={{width:40,height:40,borderRadius:11,background:'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:'#1F3A52',flexShrink:0}}>
                          <UserIcon/>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700}}>{m.vorname} {m.nachname}</div>
                          {m.objekt_bezeichnung && <div style={{fontSize:13,color:'#1F3A52',fontWeight:600,marginTop:1}}>{m.objekt_bezeichnung}</div>}
                          {(m.strasse||m.ort) && <div style={{fontSize:12,color:'#9A968B',marginTop:2}}>{[m.strasse+' '+m.hausnummer,m.plz+' '+m.ort].filter(s=>s.trim()).join(' · ')}</div>}
                          {m.email && <div style={{fontSize:12,color:'#1F3A52',marginTop:2}}>{m.email}</div>}
                          {m.telefon && <div style={{fontSize:12,color:'#9A968B'}}>{m.telefon}</div>}
                        </div>
                        <button onClick={() => deleteMieter(m.id)}
                          style={{padding:'6px 8px',borderRadius:9,border:'1px solid #E0DDD3',background:'transparent',color:'#9A968B',cursor:'pointer',display:'flex',alignItems:'center',flexShrink:0}}
                          onMouseOver={e=>{e.currentTarget.style.background='#FBEAE7';e.currentTarget.style.color='#B3402C'}}
                          onMouseOut={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#9A968B'}}>
                          <TrashIcon/>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <Card>
                <SectionLabel>Mieter hinzufügen</SectionLabel>
                <Row>
                  <Field label="Vorname *" value={mVorname} onChange={setMVorname} autoComplete="given-name" placeholder="Max"/>
                  <Field label="Nachname *" value={mNachname} onChange={setMNachname} autoComplete="family-name" placeholder="Muster"/>
                </Row>
                <Field label="Objekt / Wohnung" value={mObjekt} onChange={setMObjekt} placeholder="EG links, Musterstr. 1"/>
                <Row cols="2fr 1fr">
                  <Field label="Straße" value={mStrasse} onChange={setMStrasse} placeholder="Straße"/>
                  <Field label="Nr." value={mHausnummer} onChange={setMHausnummer} placeholder="1"/>
                </Row>
                <Row cols="1fr 2fr">
                  <Field label="PLZ" value={mPlz} onChange={setMPlz} inputMode="numeric" placeholder="12345"/>
                  <Field label="Ort" value={mOrt} onChange={setMOrt} placeholder="Berlin"/>
                </Row>
                <Field label="E-Mail" type="email" value={mEmail} onChange={setMEmail} inputMode="email" placeholder="mieter@beispiel.de"/>
                <Field label="Telefon" type="tel" value={mTelefon} onChange={v => handleTel(v, setMTelefon)} inputMode="tel" placeholder="+49 …"/>
                <PrimaryBtn onClick={addMieter} disabled={!mVorname||!mNachname} icon={<PlusIcon/>}>Mieter hinzufügen</PrimaryBtn>
              </Card>
            </div>
          )}

          {/* ── KONTAKTE ── */}
          {activeTab === 'kontakte' && (
            <div>
              {kontakte.length > 0 && (
                <div style={{marginBottom:4}}>
                  <SectionLabel>Gespeicherte Kontakte</SectionLabel>
                  {kontakte.map(k => (
                    <Card key={k.id}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                        <div style={{width:40,height:40,borderRadius:11,background:'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:'#1F3A52',flexShrink:0,fontSize:13,fontWeight:700}}>
                          {k.name[0]}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#EAF0F4',color:'#1F3A52'}}>{k.kategorie}</span>
                          </div>
                          <div style={{fontSize:15,fontWeight:700}}>{k.name}</div>
                          {k.organisation && <div style={{fontSize:13,color:'#7C786E'}}>{k.organisation}</div>}
                          {k.email && <div style={{fontSize:12,color:'#1F3A52',marginTop:2}}>{k.email}</div>}
                          {k.telefon && <div style={{fontSize:12,color:'#9A968B'}}>{k.telefon}</div>}
                          {k.notiz && <div style={{fontSize:12,color:'#9A968B',fontStyle:'italic',marginTop:4}}>{k.notiz}</div>}
                        </div>
                        <button onClick={() => deleteKontakt(k.id)}
                          style={{padding:'6px 8px',borderRadius:9,border:'1px solid #E0DDD3',background:'transparent',color:'#9A968B',cursor:'pointer',display:'flex',alignItems:'center',flexShrink:0}}
                          onMouseOver={e=>{e.currentTarget.style.background='#FBEAE7';e.currentTarget.style.color='#B3402C'}}
                          onMouseOut={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#9A968B'}}>
                          <TrashIcon/>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <Card>
                <SectionLabel>Kontakt hinzufügen</SectionLabel>
                <div style={{fontSize:12,color:'#9A968B',marginBottom:12,lineHeight:1.5}}>Wird beim Anschreiben-Generator automatisch vorgeschlagen.</div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#B6B2A6',display:'block',marginBottom:6}}>Kategorie</label>
                  <select value={kKat} onChange={e => setKKat(e.target.value)}
                    style={{width:'100%',padding:'11px 13px',borderRadius:11,border:'1.5px solid #E0DDD3',background:'#F4F2EC',color:'#1A1712',fontSize:15,fontWeight:500,fontFamily:'inherit',outline:'none'}}>
                    {KONTAKT_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <Field label="Name *" value={kName} onChange={setKName} placeholder="Dr. Klaus Hoffmann"/>
                <Field label="Organisation / Praxis" value={kOrg} onChange={setKOrg} placeholder="Praxis Dr. Hoffmann"/>
                <Field label="E-Mail" type="email" value={kEmail} onChange={setKEmail} inputMode="email" placeholder="kontakt@praxis.de"/>
                <Field label="Telefon" type="tel" value={kTelefon} onChange={v => handleTel(v, setKTelefon)} inputMode="tel" placeholder="+49 208 …"/>
                <Field label="Notiz" value={kNotiz} onChange={setKNotiz} placeholder="Mein Hausarzt seit 2010"/>
                <PrimaryBtn onClick={addKontakt} disabled={!kName} icon={<PlusIcon/>}>Kontakt hinzufügen</PrimaryBtn>
              </Card>
            </div>
          )}

          {/* ── FREIGABEN ── */}
          {activeTab === 'freigaben' && (
            <div>
              <Card style={{marginBottom:12}}>
                <SectionLabel>Mitglied einladen</SectionLabel>
                <Field label="E-Mail-Adresse" type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="familie@beispiel.de"/>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#B6B2A6',display:'block',marginBottom:8}}>Berechtigung</label>
                  {PERM_OPTS.map(p => (
                    <label key={p.value} onClick={() => setInvitePerm(p.value)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:11,border:`1.5px solid ${invitePerm===p.value?'#1F3A52':'#E0DDD3'}`,background:invitePerm===p.value?'#F7FAFB':'transparent',marginBottom:6,cursor:'pointer',transition:'all 120ms'}}>
                      <div style={{width:17,height:17,borderRadius:'50%',border:`2px solid ${invitePerm===p.value?'#1F3A52':'#E0DDD3'}`,background:invitePerm===p.value?'#1F3A52':'transparent',flexShrink:0,transition:'all 120ms'}}/>
                      <span style={{fontSize:14,fontWeight:600,color:'#1A1712'}}>{p.label}</span>
                    </label>
                  ))}
                </div>
                {inviteMsg && (
                  <div style={{borderRadius:11,padding:'10px 13px',fontSize:13,marginBottom:10,fontWeight:500,background:inviteMsg.err?'#FBEAE7':'#E9F0E9',color:inviteMsg.err?'#B3402C':'#2E7D46',border:`1px solid ${inviteMsg.err?'#f5c0b6':'#b8d9c0'}`}}>
                    {inviteMsg.text}
                  </div>
                )}
                <PrimaryBtn onClick={sendInvite} loading={inviteLoading} disabled={!inviteEmail||inviteLoading}>
                  Einladen
                </PrimaryBtn>
              </Card>

              {showQr && qrToken && (
                <Card style={{marginBottom:12,textAlign:'center'}}>
                  <SectionLabel>QR-Code</SectionLabel>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=1F3A52&data=${encodeURIComponent(qrToken)}`}
                    alt="QR" style={{borderRadius:8,border:'1px solid #EFEDE6',width:180,height:180,marginBottom:8}}/>
                  <div style={{fontSize:11,color:'#9A968B',wordBreak:'break-all',marginBottom:10}}>{qrToken}</div>
                  <button onClick={() => setShowQr(false)}
                    style={{padding:'7px 16px',borderRadius:11,border:'1px solid #E0DDD3',background:'transparent',color:'#7C786E',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    Schließen
                  </button>
                </Card>
              )}

              {familyMembers.length > 0 && (
                <Card style={{marginBottom:12}}>
                  <SectionLabel>Aktueller Zugang</SectionLabel>
                  {familyMembers.map(m => (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid #EFEDE6'}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:m.aktiv?'#1F3A52':'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:m.aktiv?'#fff':'#1F3A52',fontSize:13,fontWeight:700,flexShrink:0}}>
                        {(m.mitglied_email||'?')[0].toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.mitglied_email||'QR-Code-Einladung'}</div>
                        <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:m.aktiv?'#E9F0E9':'#FBF4E6',color:m.aktiv?'#2E7D46':'#8A5A12'}}>
                          {m.aktiv?'✓ Aktiv':'⏳ Ausstehend'} · {PERM_OPTS.find(p=>p.value===m.berechtigung)?.label||m.berechtigung}
                        </span>
                      </div>
                      <select value={m.berechtigung} onChange={e => updatePermission(m.id, e.target.value)}
                        style={{fontSize:12,padding:'4px 8px',borderRadius:11,border:'1px solid #E0DDD3',background:'#fff',color:'#1A1712',cursor:'pointer',fontFamily:'inherit'}}>
                        {PERM_OPTS.map(p => <option key={p.value} value={p.value}>{p.label.split('+')[0].trim()}</option>)}
                      </select>
                      <button onClick={() => revokeAccess(m.id)}
                        style={{padding:'6px 8px',borderRadius:9,border:'1px solid #E0DDD3',background:'transparent',color:'#9A968B',cursor:'pointer',display:'flex',alignItems:'center',flexShrink:0,fontFamily:'inherit',fontSize:13}}
                        onMouseOver={e=>{e.currentTarget.style.background='#FBEAE7';e.currentTarget.style.color='#B3402C'}}
                        onMouseOut={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#9A968B'}}>
                        ✕
                      </button>
                    </div>
                  ))}
                </Card>
              )}

              <Card>
                <SectionLabel>Nur-Scan-Modus</SectionLabel>
                <div style={{fontSize:13,color:'#7C786E',marginBottom:14,lineHeight:1.6}}>
                  Für Personen die nur Briefe fotografieren sollen — ohne App-Zugang, ohne Anmeldung.
                </div>
                {scanTokenUrl ? (
                  <div>
                    <div style={{background:'#EAF0F4',border:'1px solid #BBD0DE',borderRadius:10,padding:'10px 12px',marginBottom:12,textAlign:'center'}}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=1F3A52&data=${encodeURIComponent(scanTokenUrl)}`}
                        alt="Scan QR" style={{width:160,height:160,borderRadius:8}}/>
                      <div style={{marginTop:8,fontSize:11,color:'#9A968B',wordBreak:'break-all'}}>{scanTokenUrl}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => navigator.share?.({url:scanTokenUrl}) || window.open(scanTokenUrl,'_blank')}
                        style={{flex:1,padding:'11px 18px',borderRadius:14,border:'1.5px solid #E0DDD3',background:'#fff',color:'#1A1712',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        Link teilen
                      </button>
                      <button onClick={deactivateScanToken}
                        style={{padding:'11px 14px',borderRadius:14,border:'1px solid #F1CFC7',background:'#FBEFEC',color:'#B3402C',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                        Deaktivieren
                      </button>
                    </div>
                  </div>
                ) : (
                  <PrimaryBtn onClick={generateScanToken} loading={scanTokenLoading}>
                    Scan-Link erstellen
                  </PrimaryBtn>
                )}
              </Card>
            </div>
          )}

          {/* ── IMAP ── */}
          {activeTab === 'imap' && (
            <div>
              <Card>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:40,height:40,borderRadius:11,background:'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:'#1F3A52',flexShrink:0}}>
                    <MailIcon/>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:700}}>E-Mail Postfach verbinden</div>
                    <div style={{fontSize:12,color:'#9A968B',marginTop:1}}>Automatischer Tagesabgleich</div>
                  </div>
                  {imapSaved && (
                    <span style={{marginLeft:'auto',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,background:'#E9F0E9',color:'#2E7D46',flexShrink:0}}>Verbunden</span>
                  )}
                </div>
                <div style={{fontSize:13,color:'#7C786E',marginBottom:16,lineHeight:1.6}}>
                  PostScout liest täglich neue Mails automatisch — Anhänge werden gespeichert und analysiert.
                </div>

                <SectionLabel>Anbieter</SectionLabel>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
                  {IMAP_PROVIDERS.map(p => (
                    <button key={p.host} onClick={() => setImapHost(p.host)}
                      style={{padding:'7px 13px',borderRadius:20,border:'1.5px solid',borderColor:imapHost===p.host?'#1F3A52':'#E0DDD3',background:imapHost===p.host?'#1F3A52':'#fff',color:imapHost===p.host?'#fff':'#7C786E',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 120ms'}}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <Field label="IMAP Server" value={imapHost} onChange={setImapHost} autoCapitalize="none" autoCorrect="off"/>
                <Field label="E-Mail Adresse" type="email" value={imapUser} onChange={setImapUser} autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="deine@email.de"/>
                <Field label="App-Passwort" type="password" value={imapPass} onChange={setImapPass} autoComplete="current-password" placeholder="App-Passwort (nicht dein normales)"/>

                <NoteBox>
                  <strong>T-Online:</strong> mein.t-online.de → Sicherheit → App-Passwörter<br/>
                  <strong>Gmail:</strong> Google-Konto → Sicherheit → 2FA → App-Passwörter
                </NoteBox>

                <div style={{display:'flex',gap:8}}>
                  <button onClick={testImap} disabled={imapTesting||!imapUser||!imapPass}
                    style={{flex:1,padding:'12px 16px',borderRadius:14,border:'1.5px solid #E0DDD3',background:'#fff',color:'#1A1712',fontSize:14,fontWeight:600,cursor:(imapTesting||!imapUser||!imapPass)?'not-allowed':'pointer',opacity:(!imapUser||!imapPass)?0.4:1,fontFamily:'inherit',transition:'background 120ms'}}>
                    {imapTesting ? 'Teste…' : 'Verbindung testen'}
                  </button>
                  <button onClick={saveImap} disabled={saving||!imapUser||!imapPass}
                    style={{flex:1,padding:'12px 16px',borderRadius:14,border:'none',background:'#1F3A52',color:'#fff',fontSize:14,fontWeight:600,cursor:(saving||!imapUser||!imapPass)?'not-allowed':'pointer',opacity:(!imapUser||!imapPass)?0.4:1,fontFamily:'inherit',transition:'background 120ms'}}>
                    {saving ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Figtree", system-ui, -apple-system, sans-serif; background: #EDEBE4; -webkit-font-smoothing: antialiased; }
        input, button, select { font-family: inherit; }
        @media(max-width:400px) {
          .ps-row-2, .ps-row-21, .ps-row-12 { grid-template-columns: 1fr !important; }
        }
        @media(prefers-reduced-motion:reduce) { * { transition: none !important; } }
      `}</style>
    </>
  )
}
