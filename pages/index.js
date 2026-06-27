import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { supabase } from '../lib/supabase'

const CATS = {
  'Behörde / Ämter':           { ico: '🏛', bg: '#E6F1FB', text: '#0C447C' },
  'Gesundheit / Krankenkasse': { ico: '❤️', bg: '#FCEBEB', text: '#A32D2D' },
  'Finanzen / Bank':           { ico: '🏦', bg: '#EAF3DE', text: '#27500A' },
  'Versicherung':              { ico: '🛡', bg: '#EEEDFE', text: '#3C3489' },
  'Steuer / Finanzamt':        { ico: '🧾', bg: '#FAEEDA', text: '#633806' },
  'Rechnungen / Mahnungen':    { ico: '📋', bg: '#FAECE7', text: '#712B13' },
  'Sonstiges':                 { ico: '📄', bg: '#F1EFE8', text: '#444441' },
}

const DRING_ORDER = ['ueberfaellig', 'hoch', 'mittel', 'niedrig', 'ignorieren']
const DRING = {
  ueberfaellig: { label: 'Überfällig',     color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  hoch:         { label: 'Dringend',        color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  mittel:       { label: 'Mittelfristig',   color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  niedrig:      { label: 'Zur Kenntnis',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
  ignorieren:   { label: 'Werbung / Ablage',color: '#9a978e', bg: '#f5f4f0', border: '#e2e0d8', dot: '#9a978e' },
}

const PERM_OPTS = [
  { value: 'lesen',   label: 'Nur lesen',                desc: 'Dokumente und Aufgaben sehen' },
  { value: 'abhaken', label: 'Lesen + Abhaken',          desc: 'Aufgaben als erledigt markieren' },
  { value: 'notizen', label: 'Lesen + Abhaken + Notizen',desc: 'Zusätzlich Notizen hinzufügen' },
]
const FREQ_OPTS = [
  { value: 'taeglich',    label: 'Täglich' },
  { value: '2x_woche',    label: '2× pro Woche' },
  { value: 'woechentlich',label: 'Wöchentlich' },
]

// Home screen tiles config
const HOME_TILES = [
  { id: 'todos',  ico: '☑',  label: 'Aufgaben',   desc: 'Offene Todos & Fristen',   color: '#2563eb' },
  { id: 'scan',   ico: '📷', label: 'Scannen',     desc: 'Brief fotografieren',       color: '#16a34a' },
  { id: 'archiv', ico: '🗂',  label: 'Archiv',      desc: 'Alle Dokumente',            color: '#d97706' },
  { id: 'familie',ico: '👥', label: 'Familie',     desc: 'Zugang & Einladungen',      color: '#7c3aed' },
  { id: 'export', ico: '📤', label: 'Export',       desc: 'PDF & CSV für Steuerberater',color: '#0891b2' },
]

function randomToken() { return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2) }

export default function Home() {
  const [session, setSession]       = useState(null)
  const [authMode, setAuthMode]     = useState('login')
  const [authEmail, setAuthEmail]   = useState('')
  const [authPw, setAuthPw]         = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]       = useState(null)

  // 'home' | 'todos' | 'scan' | 'archiv' | 'familie' | 'export'
  const [view, setView]             = useState('home')

  const [photos, setPhotos]         = useState([])
  const [analyzing, setAnalyzing]   = useState(false)
  const [scanMsg, setScanMsg]       = useState(null)
  const [docs, setDocs]             = useState([])
  const [allTodos, setAllTodos]     = useState([])
  const [docFilter, setDocFilter]   = useState('Alle')
  const [exportMsg, setExportMsg]   = useState(null)
  const [mailDraft, setMailDraft]   = useState(null)

  const [familyMembers, setFamilyMembers] = useState([])
  const [inviteEmail, setInviteEmail]     = useState('')
  const [invitePerm, setInvitePerm]       = useState('abhaken')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg]         = useState(null)
  const [qrToken, setQrToken]             = useState(null)
  const [showQr, setShowQr]               = useState(false)

  const [reminderSettings, setReminderSettings] = useState(null)
  const [reminderMsg, setReminderMsg]           = useState(null)

  const [ownerView, setOwnerView]       = useState(null)
  const [myPermission, setMyPermission] = useState('notizen')

  const fileRef = useRef()
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if (session) init(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session); if (session) init(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function init(session) {
    const { data: zugaenge } = await supabase.from('familien_zugang')
      .select('inhaber_id, berechtigung').eq('mitglied_id', session.user.id).eq('aktiv', true).limit(1)
    if (zugaenge?.length > 0) {
      setOwnerView({ ownerId: zugaenge[0].inhaber_id })
      setMyPermission(zugaenge[0].berechtigung)
      loadDocsForUser(zugaenge[0].inhaber_id)
    } else {
      loadAll(session.user.id)
      loadFamilyMembers(session.user.id)
      loadReminderSettings(session.user.id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setDocs([]); setAllTodos([]); setPhotos([]); setFamilyMembers([]); setOwnerView(null); setView('home')
  }

  async function handleAuth() {
    setAuthLoading(true); setAuthMsg(null)
    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPw })
      : await supabase.auth.signUp({ email: authEmail, password: authPw })
    if (error) setAuthMsg({ text: error.message, err: true })
    else if (authMode === 'register') setAuthMsg({ text: 'Bestätigungs-E-Mail gesendet.', err: false })
    setAuthLoading(false)
  }

  // ── Data ──
  const loadAll = useCallback(async (uid) => {
    const userId = uid || session?.user?.id; if (!userId) return
    loadDocsForUser(userId)
  }, [session])

  async function loadDocsForUser(userId) {
    const { data, error } = await supabase.from('dokumente').select('*')
      .eq('user_id', userId).order('erstellt_am', { ascending: false })
    if (!error) { setDocs(data || []); buildTodoList(data || []) }
  }

  function buildTodoList(docs) {
    const flat = []
    docs.forEach(doc => {
      const cat = CATS[doc.kategorie] || CATS['Sonstiges']
      ;(doc.todos || []).forEach((t, idx) => {
        if (doc.dringlichkeit === 'ignorieren') return
        flat.push({ ...t, docId: doc.id, docName: doc.absender || doc.dateiname,
          catIco: cat.ico, todoIdx: idx,
          dringlichkeit: t.dringlichkeit || doc.dringlichkeit || 'niedrig' })
      })
    })
    flat.sort((a, b) => {
      if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1
      const da = DRING_ORDER.indexOf(a.dringlichkeit), db = DRING_ORDER.indexOf(b.dringlichkeit)
      if (da !== db) return da - db
      if (a.frist && b.frist) return new Date(a.frist) - new Date(b.frist)
      if (a.frist) return -1; if (b.frist) return 1; return 0
    })
    setAllTodos(flat)
  }

  async function loadFamilyMembers(uid) {
    const { data } = await supabase.from('familien_zugang').select('id,mitglied_email,berechtigung,aktiv,erstellt_am')
      .eq('inhaber_id', uid).order('erstellt_am', { ascending: false })
    setFamilyMembers(data || [])
  }

  async function loadReminderSettings(uid) {
    const { data } = await supabase.from('reminder_settings').select('*').eq('user_id', uid).single()
    setReminderSettings(data || { frequenz: 'taeglich', uhrzeit_utc: 7, nur_dringende: false, aktiv: false })
  }

  // ── Photos ──
  function addPhoto(f) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target.result
      setPhotos(prev => [...prev, { file: f, base64: url.split(',')[1],
        previewUrl: f.type.startsWith('image/') ? url : null, mimeType: f.type }])
    }
    reader.readAsDataURL(f)
  }
  function removePhoto(idx) { setPhotos(prev => prev.filter((_, i) => i !== idx)) }
  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('over')
    Array.from(e.dataTransfer.files).forEach(f => addPhoto(f))
  }

  // ── Analyse ──
  async function analyzeDoc() {
    if (!photos.length) return
    setAnalyzing(true); setScanMsg(null)
    try {
      const contentParts = photos.map(p => p.mimeType.startsWith('image/')
        ? { type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.base64 } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } }
      )
      contentParts.push({ type: 'text', text: photos.length > 1 ? `Analysiere diese ${photos.length} Seiten als ein Dokument.` : 'Analysiere diesen Brief.' })

      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentParts }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Fehler') }
      const r = await res.json()

      const uid = session.user.id; const ts = Date.now(); const storagePaths = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]; const path = `${uid}/${ts}_${i}_${p.file.name}`
        const { error: se } = await supabase.storage.from('dokumente').upload(path, p.file, { contentType: p.mimeType })
        if (se) throw new Error('Upload: ' + se.message)
        storagePaths.push(path)
      }

      const { error: dbErr } = await supabase.from('dokumente').insert({
        user_id: uid, dateiname: photos.map(p => p.file.name).join(', '),
        storage_path: storagePaths[0], mime_type: photos[0].mimeType,
        kategorie: r.kategorie, absender: r.absender, zusammenfassung: r.zusammenfassung,
        dringlichkeit: r.dringlichkeit, frist: parseFrist(r.frist),
        betrag: r.betrag, steuerrelevant: r.steuerrelevant,
        jahr: new Date().getFullYear(),
        todos: (r.todos || []).map(t => ({ ...t, dringlichkeit: t.dringlichkeit || r.dringlichkeit })),
        empfehlungen: r.empfehlungen || [],
      })
      if (dbErr) throw new Error('DB: ' + dbErr.message)
      if (r.mailAntwortErforderlich && r.mailVorlage) setMailDraft(r.mailVorlage)
      setPhotos([]); await loadAll(); setView('todos')
    } catch (e) { setScanMsg({ text: e.message, err: true }) }
    finally { setAnalyzing(false) }
  }

  function parseFrist(frist) {
    if (!frist) return null
    const parts = frist.split('.'); if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; return null
  }

  async function toggleTodo(docId, todoIdx) {
    const canEdit = !ownerView || myPermission === 'abhaken' || myPermission === 'notizen'
    if (!canEdit) return
    const userId = ownerView ? ownerView.ownerId : session.user.id
    const doc = docs.find(d => d.id === docId); if (!doc) return
    const newTodos = doc.todos.map((t, i) => i === todoIdx ? { ...t, erledigt: !t.erledigt } : t)
    await supabase.from('dokumente').update({ todos: newTodos }).eq('id', docId)
    loadDocsForUser(userId)
  }

  function openMail(draft) {
    window.open(`mailto:${draft.an||''}?subject=${encodeURIComponent(draft.betreff||'')}&body=${encodeURIComponent(draft.text||'')}`, '_blank')
  }

  async function downloadDoc(path, name) {
    const { data, error } = await supabase.storage.from('dokumente').download(path)
    if (error) { alert('Download fehlgeschlagen'); return }
    const url = URL.createObjectURL(data); const a = document.createElement('a')
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }

  async function deleteDoc(id, path) {
    if (!confirm('Dokument wirklich löschen?')) return
    await supabase.storage.from('dokumente').remove([path])
    await supabase.from('dokumente').delete().eq('id', id); loadAll()
  }

  // ── Family ──
  async function sendInvite() {
    if (!inviteEmail) return
    setInviteLoading(true); setInviteMsg(null)
    try {
      const token = randomToken()
      const { error } = await supabase.from('familien_zugang').insert({
        inhaber_id: session.user.id, mitglied_email: inviteEmail,
        berechtigung: invitePerm, invite_token: token, aktiv: false,
      })
      if (error) throw new Error(error.message)
      const emailRes = await fetch('/api/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteeEmail: inviteEmail, ownerName: session.user.email.split('@')[0], permission: invitePerm, inviteToken: token }),
      })
      if (!emailRes.ok) throw new Error('E-Mail-Versand fehlgeschlagen')
      setInviteMsg({ text: `Einladung an ${inviteEmail} gesendet ✓`, err: false })
      setInviteEmail(''); loadFamilyMembers(session.user.id)
    } catch (e) { setInviteMsg({ text: e.message, err: true }) }
    finally { setInviteLoading(false) }
  }

  async function generateQR() {
    const token = randomToken()
    const { error } = await supabase.from('familien_zugang').insert({
      inhaber_id: session.user.id, mitglied_email: null,
      berechtigung: invitePerm, invite_token: token, aktiv: false,
    })
    if (!error) { setQrToken(`${appUrl}/join?token=${token}`); setShowQr(true); loadFamilyMembers(session.user.id) }
  }

  async function updatePermission(zugangId, newPerm) {
    await supabase.from('familien_zugang').update({ berechtigung: newPerm }).eq('id', zugangId)
    loadFamilyMembers(session.user.id)
  }

  async function revokeAccess(zugangId) {
    if (!confirm('Zugang wirklich entziehen?')) return
    await supabase.from('familien_zugang').delete().eq('id', zugangId)
    loadFamilyMembers(session.user.id)
  }

  // ── Reminders ──
  async function saveReminder(updates) {
    const newSettings = { ...reminderSettings, ...updates, user_id: session.user.id }
    setReminderSettings(newSettings)
    const { error } = await supabase.from('reminder_settings').upsert(newSettings, { onConflict: 'user_id' })
    if (error) setReminderMsg({ text: 'Fehler: ' + error.message, err: true })
    else setReminderMsg({ text: 'Gespeichert ✓', err: false })
    setTimeout(() => setReminderMsg(null), 3000)
  }

  // ── Export ──
  function getYear() { const s = document.getElementById('year-sel'); return s ? parseInt(s.value) : new Date().getFullYear() }

  function exportCSV(nurSteuer = true) {
    const jahr = getYear()
    const filtered = docs.filter(d => (d.jahr||new Date().getFullYear())===jahr && (!nurSteuer||d.steuerrelevant||d.kategorie==='Steuer / Finanzamt'))
    if (!filtered.length) { setExportMsg({ text: 'Keine Dokumente für '+jahr, err: true }); return }
    const header = ['Datum','Absender','Kategorie','Steuerrelevant','Betrag (EUR)','Zusammenfassung','Frist','Datei']
    const rows = filtered.map(d => [
      new Date(d.erstellt_am).toLocaleDateString('de-DE'), d.absender||'', d.kategorie, d.steuerrelevant?'Ja':'Nein',
      d.betrag!=null?Number(d.betrag).toFixed(2):'', '"'+(d.zusammenfassung||'').replace(/"/g,"''")+'"',
      d.frist?new Date(d.frist).toLocaleDateString('de-DE'):'', d.dateiname||'',
    ])
    const csv = [header,...rows].map(r=>r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download=`postscout_${nurSteuer?'steuer':'alle'}_${jahr}.csv`; a.click()
    setExportMsg({ text:`✓ CSV: ${filtered.length} Dokumente`, err:false }); setTimeout(()=>setExportMsg(null),4000)
  }

  function exportPDF() {
    const jahr = getYear()
    const filtered = docs.filter(d => (d.jahr||new Date().getFullYear())===jahr&&(d.steuerrelevant||d.kategorie==='Steuer / Finanzamt'))
    if (!filtered.length) { setExportMsg({ text: 'Keine steuerrelevanten Dokumente für '+jahr, err: true }); return }
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}); const W=210,pad=18; let y=pad
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(26,25,22)
    doc.text('PostScout – Steuerübersicht '+jahr,pad,y); y+=8
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(120,120,120)
    doc.text(`${new Date().toLocaleDateString('de-DE')} · ${filtered.length} Dok.`,pad,y); y+=9
    doc.setDrawColor(228,226,217); doc.setLineWidth(0.3); doc.line(pad,y,W-pad,y); y+=7
    const gesamt=filtered.reduce((s,d)=>s+(Number(d.betrag)||0),0)
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,25,22)
    doc.text('Gesamtbetrag:',pad,y); doc.text(gesamt.toLocaleString('de-DE',{style:'currency',currency:'EUR'}),W-pad,y,{align:'right'}); y+=9
    doc.line(pad,y,W-pad,y); y+=7
    filtered.forEach((d,i)=>{
      if(y>260){doc.addPage();y=pad}
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,25,22)
      doc.text((i+1)+'. '+(d.absender||d.dateiname||'Unbekannt'),pad,y); y+=5
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,90,90)
      const bet=d.betrag!=null?' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):''
      doc.text(d.kategorie+' · '+new Date(d.erstellt_am).toLocaleDateString('de-DE')+bet,pad+3,y); y+=5
      if(d.zusammenfassung){const lines=doc.splitTextToSize(d.zusammenfassung,W-pad*2-3);doc.setTextColor(50,50,50);doc.text(lines,pad+3,y);y+=lines.length*4.5}
      if(d.frist){doc.setTextColor(180,100,0);doc.text('Frist: '+new Date(d.frist).toLocaleDateString('de-DE'),pad+3,y);y+=5}
      y+=4; doc.setDrawColor(235,235,235); doc.line(pad,y,W-pad,y); y+=6
    })
    doc.save('postscout_steuer_'+jahr+'.pdf')
    setExportMsg({ text:`✓ PDF: ${filtered.length} Dok.`, err:false }); setTimeout(()=>setExportMsg(null),4000)
  }

  // ── Derived ──
  const filteredDocs = docFilter==='Alle' ? docs : docs.filter(d=>d.kategorie===docFilter)
  const jahre = [...new Set(docs.map(d=>d.jahr||new Date().getFullYear()))].sort((a,b)=>b-a)
  const openTodos = allTodos.filter(t=>!t.erledigt).length
  const urgentTodos = allTodos.filter(t=>!t.erledigt&&(t.dringlichkeit==='ueberfaellig'||t.dringlichkeit==='hoch')).length
  const isOwner = !ownerView
  const canEdit = !ownerView || myPermission==='abhaken' || myPermission==='notizen'

  function goHome() { setView('home') }

  const viewTitle = { todos:'Aufgaben', scan:'Scannen', archiv:'Archiv', familie:'Familie', export:'Export & Einstellungen' }

  return (
    <>
      <Head>
        <title>PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✉</text></svg>" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="app">

        {/* ── HEADER ── */}
        <header className="header">
          <button className="logo-btn" onClick={session ? goHome : undefined} style={session?{cursor:'pointer'}:{cursor:'default'}}>
            <div className="logo-icon">✉</div>
            <div>
              <div className="logo-title">PostScout</div>
              {view !== 'home' && session && <div className="logo-sub">← Startseite</div>}
              {view === 'home' && <div className="logo-sub">{ownerView ? '👁 Familienansicht' : 'Briefe verstehen – nichts verpassen'}</div>}
            </div>
          </button>
          {session && (
            <button className="user-btn" onClick={signOut}>
              {session.user.email.split('@')[0]}<br/><span>Abmelden</span>
            </button>
          )}
        </header>

        {/* ── AUTH ── */}
        {!session && (
          <div className="auth-card">
            <div className="auth-title">{authMode==='login'?'Willkommen':'Konto erstellen'}</div>
            <div className="auth-sub">{authMode==='login'?'Melde dich an, um deine Briefe sicher zu verwalten.':'Erstelle ein kostenloses Konto.'}</div>
            <div className="field-group">
              <label className="field-label">E-Mail</label>
              <input className="field-input" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="name@beispiel.de"/>
            </div>
            <div className="field-group">
              <label className="field-label">Passwort</label>
              <input className="field-input" type="password" value={authPw} onChange={e=>setAuthPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="Mindestens 6 Zeichen"/>
            </div>
            {authMsg && <div className={`msg ${authMsg.err?'msg-err':'msg-ok'}`}>{authMsg.text}</div>}
            <button className="btn-primary btn-full" onClick={handleAuth} disabled={authLoading}>
              {authLoading?'Bitte warten…':authMode==='login'?'Anmelden':'Registrieren'}
            </button>
            <div className="auth-toggle">
              {authMode==='login'?'Noch kein Konto? ':'Bereits registriert? '}
              <a onClick={()=>{setAuthMode(m=>m==='login'?'register':'login');setAuthMsg(null)}}>
                {authMode==='login'?'Registrieren':'Anmelden'}
              </a>
            </div>
          </div>
        )}

        {/* ── HOME SCREEN ── */}
        {session && view === 'home' && (
          <div className="home">
            {/* Summary strip */}
            <div className="home-summary">
              {urgentTodos > 0 && (
                <div className="summary-alert" onClick={()=>setView('todos')}>
                  <span className="summary-alert-dot"/>
                  <span><strong>{urgentTodos}</strong> dringende Aufgabe{urgentTodos!==1?'n':''}</span>
                  <span className="summary-arrow">→</span>
                </div>
              )}
              {openTodos > 0 && urgentTodos === 0 && (
                <div className="summary-info" onClick={()=>setView('todos')}>
                  <span>{openTodos} offene Aufgabe{openTodos!==1?'n':''}</span>
                  <span className="summary-arrow">→</span>
                </div>
              )}
              {openTodos === 0 && (
                <div className="summary-ok">✓ Alle Aufgaben erledigt</div>
              )}
            </div>

            {/* Tile grid */}
            <div className="tile-grid">
              {HOME_TILES.filter(t => isOwner || t.id === 'todos' || t.id === 'archiv').map(tile => (
                <button key={tile.id} className="tile" onClick={()=>setView(tile.id)}>
                  <div className="tile-ico" style={{background: tile.color+'18', color: tile.color}}>{tile.ico}</div>
                  <div className="tile-label">{tile.label}</div>
                  <div className="tile-desc">{tile.desc}</div>
                  {tile.id === 'todos' && openTodos > 0 && (
                    <div className="tile-badge" style={{background: urgentTodos>0?'#dc2626':'#2563eb'}}>{openTodos}</div>
                  )}
                </button>
              ))}
            </div>

            {/* Email inbound info */}
            {isOwner && (
              <div className="email-inbound-card">
                <div className="email-inbound-title">📨 Briefe per E-Mail weiterleiten</div>
                <div className="email-inbound-desc">
                  Leite Briefe, Rechnungen oder Behördenpost einfach an diese Adresse weiter – sie werden automatisch analysiert:
                </div>
                <div className="email-inbound-addr">
                  briefe+{session.user.id.slice(0,8)}@postscout.app
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-VIEWS ── */}
        {session && view !== 'home' && (
          <div>
            {/* Back bar */}
            <div className="back-bar">
              <button className="back-btn" onClick={goHome}>← Startseite</button>
              <span className="back-title">{viewTitle[view]||''}</span>
            </div>

            {/* ── TODOS ── */}
            {view === 'todos' && (
              <div>
                {mailDraft && (
                  <div className="mail-banner">
                    <div className="mail-banner-top">
                      <span style={{fontSize:22}}>✉</span>
                      <div><div className="mail-banner-title">Antwort erforderlich</div><div className="mail-banner-sub">E-Mail-Vorlage erstellt</div></div>
                      <button className="mail-banner-close" onClick={()=>setMailDraft(null)}>✕</button>
                    </div>
                    {mailDraft.betreff&&<div className="mail-preview-row"><span>Betreff:</span> {mailDraft.betreff}</div>}
                    {mailDraft.text&&<div className="mail-preview-body">{mailDraft.text.slice(0,120)}{mailDraft.text.length>120?'…':''}</div>}
                    <button className="btn-primary" onClick={()=>openMail(mailDraft)} style={{width:'100%',marginTop:10}}>📬 In Apple Mail öffnen</button>
                  </div>
                )}

                {allTodos.length===0 ? (
                  <div className="empty"><div className="empty-ico">✅</div><p>Alle Aufgaben erledigt.</p>
                    {isOwner&&<button className="btn-ghost" onClick={()=>setView('scan')} style={{marginTop:12}}>Brief scannen →</button>}
                  </div>
                ) : (
                  <>
                    <div className="todos-summary">
                      <span className="todos-count">{openTodos} offen</span>
                      {urgentTodos>0&&<span className="todos-urgent">{urgentTodos} dringend</span>}
                      {!canEdit&&<span className="readonly-badge">👁 Nur-Lesen</span>}
                    </div>
                    {DRING_ORDER.filter(d=>d!=='ignorieren').map(dring => {
                      const group = allTodos.filter(t=>t.dringlichkeit===dring)
                      if (!group.length) return null
                      const d = DRING[dring]
                      return (
                        <div key={dring} className="todo-group">
                          <div className="todo-group-label" style={{color:d.color}}>
                            <span className="todo-group-dot" style={{background:d.dot}}/>
                            {d.label} · {group.filter(t=>!t.erledigt).length} offen
                          </div>
                          {[...group.filter(t=>!t.erledigt),...group.filter(t=>t.erledigt)].map((t,i)=>(
                            <div key={i} className={`todo-card ${t.erledigt?'todo-card-done':''}`}>
                              <button className={`todo-check ${t.erledigt?'todo-check-done':''}`}
                                onClick={()=>toggleTodo(t.docId,t.todoIdx)}
                                disabled={!canEdit} style={!canEdit?{opacity:0.4,cursor:'not-allowed'}:{}}>
                                {t.erledigt&&'✓'}
                              </button>
                              <div className="todo-content">
                                <div className="todo-aufgabe">{t.aufgabe}</div>
                                <div className="todo-meta">
                                  <span className="todo-doc">{t.catIco} {t.docName}</span>
                                  {t.frist&&<span className="todo-frist" style={{color:dring==='ueberfaellig'?'#dc2626':'#d97706'}}>
                                    {dring==='ueberfaellig'?'⚠ Überfällig: ':'📅 '}{new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}
                                  </span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── SCAN ── */}
            {view === 'scan' && isOwner && (
              <div>
                <div className="section-label">Fotos / Seiten</div>
                <div className="upload-zone" onClick={()=>fileRef.current.click()}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('over')}}
                  onDragLeave={e=>e.currentTarget.classList.remove('over')} onDrop={handleDrop}>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:'none'}}
                    onChange={e=>{Array.from(e.target.files).forEach(f=>addPhoto(f));e.target.value=''}}/>
                  <div style={{fontSize:26,marginBottom:6}}>📷</div>
                  <div className="upload-title">{photos.length>0?'Weitere Seite hinzufügen':'Foto oder PDF aufnehmen'}</div>
                  <div className="upload-hint">Mehrere Seiten möglich – z.B. Vorder- und Rückseite</div>
                  <div className="upload-actions">
                    <button className="btn-primary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📷 Aufnehmen</button>
                    <button className="btn-secondary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📁 Datei</button>
                  </div>
                </div>
                {photos.length>0&&(
                  <div className="photo-strip">
                    {photos.map((p,i)=>(
                      <div key={i} className="photo-thumb">
                        {p.previewUrl?<img src={p.previewUrl} className="photo-img" alt={`Seite ${i+1}`}/>:<div className="photo-pdf">📄</div>}
                        <div className="photo-name">{i+1}. {p.file.name.slice(0,14)}</div>
                        <button className="photo-remove" onClick={()=>removePhoto(i)}>✕</button>
                      </div>
                    ))}
                    <button className="photo-add" onClick={()=>fileRef.current.click()}>
                      <span style={{fontSize:22}}>+</span><span style={{fontSize:11}}>Seite</span>
                    </button>
                  </div>
                )}
                {scanMsg&&<div className={`msg ${scanMsg.err?'msg-err':'msg-ok'}`}>{scanMsg.text}</div>}
                <button className="btn-primary btn-full" onClick={analyzeDoc} disabled={!photos.length||analyzing} style={{marginTop:4}}>
                  {analyzing?'Wird analysiert…':'✨ Brief analysieren'}
                </button>
                {analyzing&&<div className="analyzing-hint">Claude liest den Brief – dauert 10–20 Sekunden</div>}
              </div>
            )}

            {/* ── ARCHIV ── */}
            {view === 'archiv' && (
              <div>
                <div className="stat-row">
                  <div className="stat-cell"><div className="stat-lbl">Dokumente</div><div className="stat-val">{docs.length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Steuerrelevant</div><div className="stat-val">{docs.filter(d=>d.steuerrelevant).length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Offene Todos</div><div className="stat-val">{openTodos}</div></div>
                </div>
                <div className="chip-bar">
                  {['Alle',...Object.keys(CATS)].map(c=>(
                    <button key={c} className={`chip ${docFilter===c?'chip-active':''}`} onClick={()=>setDocFilter(c)}>{c}</button>
                  ))}
                </div>
                {filteredDocs.length===0
                  ? <div className="empty"><div className="empty-ico">📭</div><p>Keine Dokumente.</p></div>
                  : filteredDocs.map(d=>{
                    const cat=CATS[d.kategorie]||CATS['Sonstiges']; const dr=DRING[d.dringlichkeit]||DRING.niedrig
                    return (
                      <div key={d.id} className="doc-card">
                        <div className="doc-card-top">
                          <div className="doc-cat-ico" style={{background:cat.bg,color:cat.text}}>{cat.ico}</div>
                          <div className="doc-info">
                            <div className="doc-name">{d.absender||d.dateiname}</div>
                            <div className="doc-meta">{d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}{d.betrag!=null&&' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}</div>
                          </div>
                          <span className="dring-pill" style={{background:dr.bg,color:dr.color,border:`0.5px solid ${dr.border}`}}>{dr.label}</span>
                        </div>
                        {d.zusammenfassung&&<p className="doc-summary">{d.zusammenfassung}</p>}
                        {isOwner&&<div className="doc-actions">
                          <button className="btn-ghost btn-sm" onClick={()=>downloadDoc(d.storage_path,d.dateiname)}>⬇ Laden</button>
                          <button className="btn-ghost btn-sm btn-danger" onClick={()=>deleteDoc(d.id,d.storage_path)}>🗑 Löschen</button>
                        </div>}
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* ── FAMILIE ── */}
            {view === 'familie' && isOwner && (
              <div>
                <div className="settings-card">
                  <div className="settings-title">👥 Familienmitglied einladen</div>
                  <div className="field-group" style={{marginTop:12}}>
                    <label className="field-label">E-Mail-Adresse</label>
                    <input className="field-input" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="familie@beispiel.de"/>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Berechtigung</label>
                    {PERM_OPTS.map(p=>(
                      <label key={p.value} className={`perm-opt ${invitePerm===p.value?'perm-opt-active':''}`} onClick={()=>setInvitePerm(p.value)}>
                        <div className={`perm-radio ${invitePerm===p.value?'perm-radio-on':''}`}/>
                        <div><div className="perm-label">{p.label}</div><div className="perm-desc">{p.desc}</div></div>
                      </label>
                    ))}
                  </div>
                  {inviteMsg&&<div className={`msg ${inviteMsg.err?'msg-err':'msg-ok'}`}>{inviteMsg.text}</div>}
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <button className="btn-primary" style={{flex:1}} onClick={sendInvite} disabled={!inviteEmail||inviteLoading}>
                      {inviteLoading?'Wird gesendet…':'✉ Per E-Mail einladen'}
                    </button>
                    <button className="btn-secondary" onClick={generateQR}>QR</button>
                  </div>
                </div>
                {showQr&&qrToken&&(
                  <div className="settings-card" style={{textAlign:'center'}}>
                    <div className="settings-title" style={{marginBottom:12}}>📱 QR-Code</div>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken)}`}
                      alt="QR-Code" style={{borderRadius:8,border:'0.5px solid #e2e0d8',width:180,height:180}}/>
                    <div style={{fontSize:11,color:'#9a978e',marginTop:8,wordBreak:'break-all'}}>{qrToken}</div>
                    <button className="btn-ghost btn-sm" onClick={()=>setShowQr(false)} style={{marginTop:10}}>Schließen</button>
                  </div>
                )}
                {familyMembers.length>0&&(
                  <div className="settings-card">
                    <div className="settings-title">Aktueller Zugang</div>
                    {familyMembers.map(m=>(
                      <div key={m.id} className="member-row">
                        <div className="member-info">
                          <div className="member-email">{m.mitglied_email||'QR-Code-Einladung'}</div>
                          <span className={`member-status ${m.aktiv?'member-active':'member-pending'}`}>{m.aktiv?'✓ Aktiv':'⏳ Ausstehend'}</span>
                        </div>
                        <select className="perm-select" value={m.berechtigung} onChange={e=>updatePermission(m.id,e.target.value)}>
                          {PERM_OPTS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <button className="btn-ghost btn-sm btn-danger" onClick={()=>revokeAccess(m.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── EXPORT + REMINDERS ── */}
            {view === 'export' && isOwner && (
              <div>
                <div className="section-label">Steuerjahr</div>
                <select className="year-sel" id="year-sel">
                  {(jahre.length?jahre:[new Date().getFullYear()]).map(j=><option key={j} value={j}>{j}</option>)}
                </select>
                <div className="export-card">
                  <div className="export-title">🔴 PDF für Steuerberater</div>
                  <div className="export-desc">Steuerrelevante Dokumente – druckfertig mit Zusammenfassung und Fristen.</div>
                  <button className="btn-primary" onClick={exportPDF}>⬇ PDF herunterladen</button>
                </div>
                <div className="export-card">
                  <div className="export-title">🟢 CSV für Excel / DATEV</div>
                  <div className="export-desc">Tabellarische Übersicht aller steuerrelevanten Belege.</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="btn-primary" onClick={()=>exportCSV(true)}>⬇ Steuer-CSV</button>
                    <button className="btn-secondary" onClick={()=>exportCSV(false)}>⬇ Alle</button>
                  </div>
                </div>
                {exportMsg&&<div className={`msg ${exportMsg.err?'msg-err':'msg-ok'}`}>{exportMsg.text}</div>}

                <div className="settings-card" style={{marginTop:8}}>
                  <div className="settings-title">🔔 E-Mail-Reminder</div>
                  <div className="toggle-row" style={{marginTop:12}}>
                    <span className="toggle-label">Reminder aktiviert</span>
                    <button className={`toggle-btn ${reminderSettings?.aktiv?'toggle-on':''}`} onClick={()=>saveReminder({aktiv:!reminderSettings?.aktiv})}>
                      <div className="toggle-knob"/>
                    </button>
                  </div>
                  {reminderSettings?.aktiv&&(
                    <>
                      <div className="field-group" style={{marginTop:12}}>
                        <label className="field-label">Häufigkeit</label>
                        {FREQ_OPTS.map(f=>(
                          <label key={f.value} className={`perm-opt ${reminderSettings?.frequenz===f.value?'perm-opt-active':''}`} onClick={()=>saveReminder({frequenz:f.value})}>
                            <div className={`perm-radio ${reminderSettings?.frequenz===f.value?'perm-radio-on':''}`}/><div className="perm-label">{f.label}</div>
                          </label>
                        ))}
                      </div>
                      <div className="field-group">
                        <label className="field-label">Uhrzeit</label>
                        <select className="year-sel" style={{width:'100%'}} value={reminderSettings?.uhrzeit_utc??7} onChange={e=>saveReminder({uhrzeit_utc:parseInt(e.target.value)})}>
                          {[6,7,8,9,10,12,18,20].map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00 Uhr</option>)}
                        </select>
                      </div>
                      <div className="toggle-row">
                        <div>
                          <div className="toggle-label">Nur zeitkritische Todos</div>
                          <div style={{fontSize:11,color:'#9a978e',marginTop:2}}>Nur Dringendes + Frist innerhalb 7 Tage</div>
                        </div>
                        <button className={`toggle-btn ${reminderSettings?.nur_dringende?'toggle-on':''}`} onClick={()=>saveReminder({nur_dringende:!reminderSettings?.nur_dringende})}>
                          <div className="toggle-knob"/>
                        </button>
                      </div>
                    </>
                  )}
                  {reminderMsg&&<div className={`msg ${reminderMsg.err?'msg-err':'msg-ok'}`} style={{marginTop:10}}>{reminderMsg.text}</div>}
                </div>

                {/* Cloud folder sync info */}
                <div className="settings-card">
                  <div className="settings-title">☁ Ordner-Sync</div>
                  <div style={{fontSize:13,color:'#5a5850',lineHeight:1.6,marginTop:8}}>
                    Speichere gescannte Dokumente in einem Cloud-Ordner – PostScout kann diesen automatisch überwachen.<br/><br/>
                    <strong>Unterstützte Dienste:</strong> Google Drive, iCloud Drive, Dropbox<br/><br/>
                    Verbinde deinen Cloud-Ordner über die Einstellungen – neue Dateien werden stündlich automatisch analysiert.
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                    <button className="btn-secondary" style={{opacity:0.5,cursor:'not-allowed'}} disabled>🔵 Google Drive (demnächst)</button>
                    <button className="btn-secondary" style={{opacity:0.5,cursor:'not-allowed'}} disabled>☁ iCloud (demnächst)</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BOTTOM NAV (nur in Sub-Views) ── */}
        {session && view !== 'home' && (
          <nav className="bottom-nav">
            {HOME_TILES.filter(t => isOwner || t.id==='todos'||t.id==='archiv').map(tile=>(
              <button key={tile.id} className={`bottom-tab ${view===tile.id?'bottom-tab-active':''}`} onClick={()=>setView(tile.id)}>
                <span className="bottom-tab-ico">{tile.ico}</span>
                <span className="bottom-tab-label">{tile.label}</span>
                {tile.id==='todos'&&openTodos>0&&<span className="bottom-badge" style={{background:urgentTodos>0?'#dc2626':'#2563eb'}}>{openTodos}</span>}
              </button>
            ))}
          </nav>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --ease:cubic-bezier(0.23,1,0.32,1);
          --bg:#f5f4f0;--surface:#fff;--surface2:#ededea;
          --border:#e2e0d8;--border2:#ccc9be;
          --text:#1a1916;--text2:#5a5850;--text3:#9a978e;
          --accent:#2563eb;--accent-h:#1d4ed8;--accent-bg:#eff6ff;
        }
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
        .app{max-width:460px;margin:0 auto;padding:1.25rem 1rem 6rem}

        /* Header */
        .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
        .logo-btn{display:flex;align-items:center;gap:10px;background:none;border:none;padding:0;text-align:left;cursor:default}
        .logo-icon{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;flex-shrink:0}
        .logo-title{font-size:17px;font-weight:600;color:var(--text)}
        .logo-sub{font-size:11px;color:var(--text3)}
        .user-btn{background:var(--surface2);border:0.5px solid var(--border2);border-radius:8px;padding:6px 10px;font-size:11px;color:var(--text2);cursor:pointer;text-align:right;line-height:1.4;transition:background 140ms}
        .user-btn:hover{background:#fef2f2;color:#991b1b}
        .user-btn span{color:var(--text3)}

        /* Auth */
        .auth-card{background:var(--surface);border:0.5px solid var(--border);border-radius:16px;padding:1.75rem;margin-top:1rem}
        .auth-title{font-size:20px;font-weight:600;margin-bottom:5px}
        .auth-sub{font-size:13px;color:var(--text2);margin-bottom:1.25rem;line-height:1.5}
        .field-group{margin-bottom:10px}
        .field-label{font-size:12px;font-weight:500;color:var(--text2);display:block;margin-bottom:5px}
        .field-input{width:100%;padding:10px 12px;border-radius:8px;border:0.5px solid var(--border2);background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;transition:border-color 150ms}
        .field-input:focus{outline:none;border-color:var(--accent)}
        .auth-toggle{font-size:12px;color:var(--text3);margin-top:12px;text-align:center}
        .auth-toggle a{color:var(--accent);cursor:pointer}

        /* Home */
        .home-summary{margin-bottom:1.25rem}
        .summary-alert{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#fef2f2;border:0.5px solid #fecaca;border-radius:11px;cursor:pointer;font-size:14px;color:#991b1b}
        .summary-alert-dot{width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0;animation:pulse 1.5s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .summary-info{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border:0.5px solid var(--border);border-radius:11px;cursor:pointer;font-size:14px;color:var(--text2)}
        .summary-ok{padding:10px 14px;background:#f0fdf4;border:0.5px solid #bbf7d0;border-radius:11px;font-size:14px;color:#15803d;text-align:center}
        .summary-arrow{margin-left:auto;color:var(--text3)}
        .tile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.25rem}
        .tile{background:var(--surface);border:0.5px solid var(--border);border-radius:14px;padding:16px;text-align:left;cursor:pointer;transition:transform 120ms var(--ease),border-color 120ms;position:relative;display:flex;flex-direction:column;gap:4px;font-family:inherit}
        .tile:hover{transform:scale(1.02);border-color:var(--border2)}
        .tile:active{transform:scale(0.98)}
        .tile-ico{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:6px}
        .tile-label{font-size:15px;font-weight:600;color:var(--text)}
        .tile-desc{font-size:11px;color:var(--text3);line-height:1.4}
        .tile-badge{position:absolute;top:10px;right:10px;background:#2563eb;color:#fff;border-radius:20px;font-size:11px;font-weight:600;padding:2px 8px;min-width:22px;text-align:center}
        .email-inbound-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:14px;margin-top:4px}
        .email-inbound-title{font-size:14px;font-weight:500;margin-bottom:6px}
        .email-inbound-desc{font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:10px}
        .email-inbound-addr{font-size:13px;font-family:monospace;background:var(--surface2);border:0.5px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--accent);word-break:break-all}

        /* Back bar */
        .back-bar{display:flex;align-items:center;gap:10px;margin-bottom:1.25rem}
        .back-btn{background:var(--surface2);border:0.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--text2);cursor:pointer;font-family:inherit;transition:background 120ms;white-space:nowrap}
        .back-btn:hover{background:var(--border)}
        .back-title{font-size:16px;font-weight:600;color:var(--text)}

        /* Bottom nav */
        .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:0.5px solid var(--border);display:flex;z-index:100;padding:4px 0 max(4px,env(safe-area-inset-bottom))}
        .bottom-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:none;background:transparent;cursor:pointer;position:relative;transition:opacity 120ms;font-family:inherit}
        .bottom-tab:active{opacity:0.6}
        .bottom-tab-ico{font-size:20px;line-height:1}
        .bottom-tab-label{font-size:10px;color:var(--text3);font-weight:500}
        .bottom-tab-active .bottom-tab-label{color:var(--accent)}
        .bottom-tab-active .bottom-tab-ico{transform:scale(1.1)}
        .bottom-badge{position:absolute;top:4px;right:calc(50% - 18px);background:#dc2626;color:#fff;border-radius:20px;font-size:9px;font-weight:700;padding:1px 5px;min-width:16px;text-align:center}

        /* Buttons */
        .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:14px;font-family:inherit;cursor:pointer;font-weight:500;transition:background 140ms var(--ease),transform 100ms}
        .btn-primary:hover{background:var(--accent-h)}
        .btn-primary:active{transform:scale(0.97)}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .btn-full{width:100%;padding:13px;font-size:15px;border-radius:11px}
        .btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:9px;border:0.5px solid var(--border2);background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;cursor:pointer;font-weight:500;transition:background 140ms}
        .btn-secondary:hover{background:var(--surface2)}
        .btn-ghost{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:8px;border:0.5px solid var(--border);background:transparent;color:var(--text2);font-size:13px;font-family:inherit;cursor:pointer;transition:background 120ms}
        .btn-ghost:hover{background:var(--surface2)}
        .btn-sm{padding:6px 10px;font-size:12px}
        .btn-danger:hover{background:#fef2f2;color:#991b1b;border-color:#fecaca}
        .section-label{font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px}

        /* Upload */
        .upload-zone{border:1.5px dashed var(--border2);border-radius:14px;padding:1.5rem 1rem;text-align:center;cursor:pointer;transition:border-color 160ms,background 160ms;margin-bottom:10px}
        .upload-zone:hover,.upload-zone.over{border-color:var(--accent);background:var(--accent-bg)}
        .upload-title{font-size:14px;font-weight:500;margin-bottom:3px}
        .upload-hint{font-size:12px;color:var(--text3);margin-bottom:10px}
        .upload-actions{display:flex;gap:8px;justify-content:center}
        .photo-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px;margin-bottom:8px;scrollbar-width:none}
        .photo-strip::-webkit-scrollbar{display:none}
        .photo-thumb{position:relative;flex-shrink:0;width:72px}
        .photo-img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:0.5px solid var(--border)}
        .photo-pdf{width:72px;height:72px;border-radius:8px;border:0.5px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px}
        .photo-name{font-size:10px;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .photo-remove{position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#dc2626;color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center}
        .photo-add{flex-shrink:0;width:72px;height:72px;border-radius:8px;border:1.5px dashed var(--border2);background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);font-family:inherit;gap:2px}
        .photo-add:hover{background:var(--surface2)}
        .analyzing-hint{text-align:center;font-size:12px;color:var(--text3);margin-top:8px}

        /* Todos */
        .todos-summary{display:flex;align-items:center;gap:8px;margin-bottom:1rem;padding:10px 14px;background:var(--surface);border:0.5px solid var(--border);border-radius:11px;flex-wrap:wrap}
        .todos-count{font-size:15px;font-weight:600}
        .todos-urgent{font-size:12px;font-weight:500;background:#fef2f2;color:#991b1b;border:0.5px solid #fecaca;border-radius:20px;padding:2px 10px}
        .readonly-badge{font-size:11px;color:var(--text3);background:var(--surface2);border:0.5px solid var(--border);border-radius:20px;padding:2px 8px;margin-left:auto}
        .todo-group{margin-bottom:1.25rem}
        .todo-group-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.04em}
        .todo-group-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .todo-card{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;background:var(--surface);border:0.5px solid var(--border);border-radius:11px;margin-bottom:6px;transition:opacity 200ms}
        .todo-card-done{opacity:0.45}
        .todo-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border2);flex-shrink:0;margin-top:1px;cursor:pointer;background:transparent;font-size:12px;color:#fff;display:flex;align-items:center;justify-content:center;transition:background 140ms,border-color 140ms;font-family:inherit}
        .todo-check-done{background:#16a34a;border-color:#16a34a}
        .todo-content{flex:1;min-width:0}
        .todo-aufgabe{font-size:14px;color:var(--text);line-height:1.4;margin-bottom:4px}
        .todo-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .todo-doc{font-size:11px;color:var(--text3)}
        .todo-frist{font-size:11px;font-weight:500}

        /* Mail */
        .mail-banner{background:#eff6ff;border:0.5px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:1rem}
        .mail-banner-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .mail-banner-title{font-size:14px;font-weight:600;color:#1e40af}
        .mail-banner-sub{font-size:12px;color:#3b82f6}
        .mail-banner-close{margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:16px;color:#93c5fd;padding:2px 6px}
        .mail-preview-row{font-size:12px;color:var(--text2);margin-bottom:4px;background:#fff;border-radius:6px;padding:6px 10px}
        .mail-preview-row span{font-weight:500;color:var(--text)}
        .mail-preview-body{font-size:12px;color:var(--text3);line-height:1.5;background:#fff;border-radius:6px;padding:6px 10px;margin-top:4px}

        /* Archive */
        .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem}
        .stat-cell{background:var(--surface2);border-radius:9px;padding:10px 12px}
        .stat-lbl{font-size:11px;color:var(--text3);margin-bottom:3px}
        .stat-val{font-size:22px;font-weight:600}
        .chip-bar{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:1rem}
        .chip{padding:5px 10px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;border:0.5px solid var(--border2);background:var(--surface);color:var(--text2);transition:background 110ms,color 110ms;font-family:inherit}
        .chip-active{background:var(--accent);color:#fff;border-color:transparent}
        .doc-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px}
        .doc-card-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:6px}
        .doc-cat-ico{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
        .doc-info{flex:1;min-width:0}
        .doc-name{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .doc-meta{font-size:11px;color:var(--text3);margin-top:2px}
        .doc-summary{font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:10px}
        .doc-actions{display:flex;gap:6px}
        .dring-pill{font-size:11px;font-weight:500;padding:3px 9px;border-radius:20px;flex-shrink:0;white-space:nowrap}

        /* Settings */
        .settings-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px}
        .settings-title{font-size:14px;font-weight:600}
        .perm-opt{display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:8px;border:0.5px solid var(--border);margin-bottom:6px;cursor:pointer;transition:border-color 120ms,background 120ms}
        .perm-opt-active{border-color:var(--accent);background:var(--accent-bg)}
        .perm-radio{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--border2);flex-shrink:0;margin-top:2px;transition:border-color 120ms,background 120ms}
        .perm-radio-on{border-color:var(--accent);background:var(--accent)}
        .perm-label{font-size:13px;font-weight:500;color:var(--text)}
        .perm-desc{font-size:11px;color:var(--text3);margin-top:1px}
        .member-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:0.5px solid var(--border)}
        .member-row:last-child{border-bottom:none}
        .member-info{flex:1;min-width:0}
        .member-email{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .member-status{font-size:11px;padding:2px 8px;border-radius:20px;display:inline-block;margin-top:3px}
        .member-active{background:#f0fdf4;color:#15803d}
        .member-pending{background:#fffbeb;color:#92400e}
        .perm-select{font-size:12px;padding:4px 6px;border-radius:6px;border:0.5px solid var(--border2);background:var(--surface);color:var(--text);font-family:inherit;cursor:pointer}
        .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--border);margin-top:4px;gap:12px}
        .toggle-label{font-size:13px;font-weight:500;color:var(--text)}
        .toggle-btn{width:44px;height:24px;border-radius:20px;border:none;background:var(--border2);cursor:pointer;position:relative;transition:background 200ms;padding:0;flex-shrink:0}
        .toggle-on{background:var(--accent)}
        .toggle-knob{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:transform 200ms var(--ease)}
        .toggle-on .toggle-knob{transform:translateX(20px)}
        .export-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px}
        .export-title{font-size:14px;font-weight:500;margin-bottom:4px}
        .export-desc{font-size:13px;color:var(--text2);margin-bottom:10px;line-height:1.5}
        .year-sel{padding:8px 12px;border-radius:8px;border:0.5px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;margin-bottom:12px;cursor:pointer}

        /* Msgs */
        .msg{border-radius:9px;padding:10px 13px;font-size:13px;margin-bottom:10px;line-height:1.5}
        .msg-err{background:#fef2f2;color:#991b1b;border:0.5px solid #fecaca}
        .msg-ok{background:#f0fdf4;color:#15803d;border:0.5px solid #bbf7d0}
        .empty{text-align:center;padding:2.5rem 1rem;color:var(--text3)}
        .empty-ico{font-size:32px;margin-bottom:10px}
        .empty p{font-size:14px}

        @media(prefers-reduced-motion:reduce){
          .tile,.todo-card,.btn-primary,.btn-secondary,.btn-ghost,.upload-zone,.chip,.todo-check,.toggle-btn,.toggle-knob,.bottom-tab-ico{transition:none}
          @keyframes pulse{0%,100%{opacity:1}}
        }
      `}</style>
    </>
  )
}
