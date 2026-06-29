import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { supabase } from '../lib/supabase'

const CATS = {
  'Behörde / Ämter':           { ico: '🏛', bg: '#E8EEF8', text: '#1E3A5F' },
  'Gesundheit / Krankenkasse': { ico: '❤️', bg: '#FCEAEA', text: '#7B1F1F' },
  'Finanzen / Bank':           { ico: '🏦', bg: '#E8F2EA', text: '#1A4A22' },
  'Versicherung':              { ico: '🛡', bg: '#EEE8F8', text: '#3A1E7B' },
  'Steuer / Finanzamt':        { ico: '🧾', bg: '#FBF3E2', text: '#5C3A00' },
  'Rechnungen / Mahnungen':    { ico: '📋', bg: '#FAEAEA', text: '#5C1A00' },
  'Sonstiges':                 { ico: '📄', bg: '#F0F0F0', text: '#444444' },
}
const DRING_ORDER = ['ueberfaellig','hoch','mittel','niedrig','ignorieren']
const DRING = {
  ueberfaellig: { label:'Überfällig',      color:'#B91C1C', bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444' },
  hoch:         { label:'Dringend',         color:'#C2410C', bg:'#FFF7ED', border:'#FED7AA', dot:'#F97316' },
  mittel:       { label:'Mittelfristig',    color:'#B45309', bg:'#FFFBEB', border:'#FDE68A', dot:'#F59E0B' },
  niedrig:      { label:'Zur Kenntnis',     color:'#15803D', bg:'#F0FDF4', border:'#BBF7D0', dot:'#22C55E' },
  ignorieren:   { label:'Werbung',          color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB', dot:'#9CA3AF' },
}
const PERM_OPTS = [
  { value:'lesen',   label:'Nur lesen',                desc:'Dokumente und Aufgaben sehen' },
  { value:'abhaken', label:'Lesen + Abhaken',           desc:'Aufgaben als erledigt markieren' },
  { value:'notizen', label:'Lesen + Abhaken + Notizen', desc:'Zusätzlich Notizen hinzufügen' },
]
const FREQ_OPTS = [
  { value:'taeglich',    label:'Täglich' },
  { value:'2x_woche',    label:'2× pro Woche' },
  { value:'woechentlich',label:'Wöchentlich' },
]
const HOME_TILES = [
  { id:'todos',  ico:'✅', label:'Aufgaben',  desc:'Offene Todos & Fristen',     color:'#0A1628' },
  { id:'scan',   ico:'📷', label:'Scannen',   desc:'Brief fotografieren',         color:'#0A1628' },
  { id:'archiv', ico:'🗂',  label:'Archiv',    desc:'Alle Dokumente',              color:'#0A1628' },
  { id:'familie',ico:'👥', label:'Familie',   desc:'Zugang & Einladungen',        color:'#0A1628' },
  { id:'export', ico:'📤', label:'Export',    desc:'Steuerberater & CSV',         color:'#0A1628' },
  { id:'profil', ico:'👤', label:'Profil',    desc:'Daten, Mieter & E-Mail',      color:'#0A1628', href:'/profil' },
]

function randomToken() { return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2) }

export default function Home() {
  const [session, setSession]         = useState(null)
  const [authMode, setAuthMode]       = useState('login')
  const [authEmail, setAuthEmail]     = useState('')
  const [authPw, setAuthPw]           = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]         = useState(null)
  const [view, setView]               = useState('home')
  const [photos, setPhotos]           = useState([])
  const [analyzing, setAnalyzing]     = useState(false)
  const [scanMsg, setScanMsg]         = useState(null)
  const [docs, setDocs]               = useState([])
  const [allTodos, setAllTodos]       = useState([])
  const [docFilter, setDocFilter]     = useState('Alle')
  const [exportMsg, setExportMsg]     = useState(null)
  const [mailDraft, setMailDraft]     = useState(null)
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
  const [anschreiben, setAnschreiben]   = useState(null)
  const [anschreibenDoc, setAnschreibenDoc] = useState(null)
  const [duplikatWarnung, setDuplikatWarnung] = useState(null)
  const [selectedDoc, setSelectedDoc]   = useState(null) // for detail modal
  const [neueNotiz, setNeueNotiz]       = useState('')
  const [notizSaving, setNotizSaving]   = useState(false)
  const [docReminder, setDocReminder]   = useState('') // date string
  const [kontakte, setKontakte]         = useState([])
  const fileRef = useRef()
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

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
      .select('inhaber_id,berechtigung').eq('mitglied_id', session.user.id).eq('aktiv', true).limit(1)
    if (zugaenge?.length > 0) {
      setOwnerView({ ownerId: zugaenge[0].inhaber_id })
      setMyPermission(zugaenge[0].berechtigung)
      loadDocsForUser(zugaenge[0].inhaber_id)
    } else {
      loadAll(session.user.id)
      loadFamilyMembers(session.user.id)
      loadReminderSettings(session.user.id)
      loadKontakte(session.user.id)
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
          catIco: cat.ico, todoIdx: idx, dringlichkeit: t.dringlichkeit || doc.dringlichkeit || 'niedrig' })
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
    setReminderSettings(data || { frequenz:'taeglich', uhrzeit_utc:7, nur_dringende:false, aktiv:false })
  }

  function addPhoto(f) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target.result
      setPhotos(prev => [...prev, { file:f, base64:url.split(',')[1], previewUrl:f.type.startsWith('image/')?url:null, mimeType:f.type }])
    }
    reader.readAsDataURL(f)
  }
  function removePhoto(idx) { setPhotos(prev => prev.filter((_,i) => i !== idx)) }
  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('over')
    Array.from(e.dataTransfer.files).forEach(f => addPhoto(f))
  }

  async function analyzeDoc() {
    if (!photos.length) return
    setAnalyzing(true); setScanMsg(null); setDuplikatWarnung(null)
    try {
      const uid = session.user.id
      const contentParts = photos.map(p => p.mimeType.startsWith('image/')
        ? { type:'image', source:{ type:'base64', media_type:p.mimeType, data:p.base64 } }
        : { type:'document', source:{ type:'base64', media_type:'application/pdf', data:p.base64 } }
      )
      contentParts.push({ type:'text', text: photos.length>1?`Analysiere diese ${photos.length} Seiten als ein Dokument.`:'Analysiere diesen Brief.' })
      const res = await fetch('/api/analyze', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contentParts, userId: uid }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error||'Fehler') }
      const r = await res.json()

      // Duplikat gefunden?
      if (r.duplikat) {
        setDuplikatWarnung(r.duplikat)
        setAnalyzing(false)
        return // Nicht speichern – User entscheidet
      }

      const ts = Date.now(); const storagePaths = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]; const path = `${uid}/${ts}_${i}_${p.file.name}`
        const { error: se } = await supabase.storage.from('dokumente').upload(path, p.file, { contentType:p.mimeType })
        if (se) throw new Error('Upload: '+se.message)
        storagePaths.push(path)
      }
      const { error: dbErr } = await supabase.from('dokumente').insert({
        user_id:uid, dateiname:photos.map(p=>p.file.name).join(', '),
        storage_path:storagePaths[0], mime_type:photos[0].mimeType,
        kategorie:r.kategorie, absender:r.absender, zusammenfassung:r.zusammenfassung,
        dringlichkeit:r.dringlichkeit, frist:parseFrist(r.frist),
        betrag:r.betrag, steuerrelevant:r.steuerrelevant, jahr:new Date().getFullYear(),
        todos:(r.todos||[]).map(t=>({...t, dringlichkeit:t.dringlichkeit||r.dringlichkeit, status:'offen'})),
        empfehlungen:r.empfehlungen||[], quelle:'scan', anhaenge:[],
        inhalts_hash: r.inhaltsHash || null,
        notizen: [],
      })
      if (dbErr) throw new Error('DB: '+dbErr.message)
      if (r.mailAntwortErforderlich && r.mailVorlage) setMailDraft(r.mailVorlage)
      setPhotos([]); await loadAll(); setView('todos')
    } catch(e) { setScanMsg({ text:e.message, err:true }) }
    finally { setAnalyzing(false) }
  }

  function parseFrist(frist) {
    if (!frist) return null
    const parts = frist.split('.'); if (parts.length===3) return `${parts[2]}-${parts[1]}-${parts[0]}`; return null
  }

  // Todo Status: offen → in_bearbeitung → wartet → erledigt → offen
  const TODO_STATUS = {
    offen:          { label:'Offen',             next:'in_bearbeitung', color:'#D1D5DB', bg:'transparent' },
    in_bearbeitung: { label:'In Bearbeitung',    next:'wartet',         color:'#F59E0B', bg:'#FFFBEB' },
    wartet:         { label:'Warte auf Antwort', next:'erledigt',       color:'#3B82F6', bg:'#EFF6FF' },
    erledigt:       { label:'Erledigt',          next:'offen',          color:'#15803D', bg:'#F0FDF4' },
  }

  async function cycleTodoStatus(docId, todoIdx) {
    const canEdit = !ownerView || myPermission==='abhaken' || myPermission==='notizen'
    if (!canEdit) return
    const userId = ownerView ? ownerView.ownerId : session.user.id
    const doc = docs.find(d => d.id===docId); if (!doc) return
    const todo = doc.todos[todoIdx]
    const currentStatus = todo.status || (todo.erledigt ? 'erledigt' : 'offen')
    const nextStatus = TODO_STATUS[currentStatus]?.next || 'offen'
    const autorName = session.user.email.split('@')[0]
    const newTodos = doc.todos.map((t, i) => i===todoIdx ? {
      ...t,
      status: nextStatus,
      erledigt: nextStatus === 'erledigt',
      erledigt_am: nextStatus === 'erledigt' ? new Date().toISOString() : null,
      erledigt_von: nextStatus === 'erledigt' ? autorName : null,
    } : t)
    await supabase.from('dokumente').update({ todos: newTodos }).eq('id', docId)
    loadDocsForUser(userId)
  }

  async function toggleTodo(docId, todoIdx) {
    return cycleTodoStatus(docId, todoIdx)
  }

  function openMail(draft) {
    window.open(`mailto:${draft.an||''}?subject=${encodeURIComponent(draft.betreff||'')}&body=${encodeURIComponent(draft.text||'')}`, '_blank')
  }

  async function downloadDoc(path, name) {
    const { data, error } = await supabase.storage.from('dokumente').download(path)
    if (error) { alert('Download fehlgeschlagen'); return }
    const url = URL.createObjectURL(data); const a = document.createElement('a')
    a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url)
  }

  async function deleteDoc(id, path) {
    if (!confirm('Dokument wirklich löschen?')) return
    await supabase.storage.from('dokumente').remove([path])
    await supabase.from('dokumente').delete().eq('id', id); loadAll()
  }

  async function sendInvite() {
    if (!inviteEmail) return
    setInviteLoading(true); setInviteMsg(null)
    try {
      const token = randomToken()
      const { error } = await supabase.from('familien_zugang').insert({
        inhaber_id:session.user.id, mitglied_email:inviteEmail, berechtigung:invitePerm, invite_token:token, aktiv:false,
      })
      if (error) throw new Error(error.message)
      const emailRes = await fetch('/api/invite', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ inviteeEmail:inviteEmail, ownerName:session.user.email.split('@')[0], permission:invitePerm, inviteToken:token }),
      })
      if (!emailRes.ok) throw new Error('E-Mail-Versand fehlgeschlagen')
      setInviteMsg({ text:`Einladung an ${inviteEmail} gesendet ✓`, err:false })
      setInviteEmail(''); loadFamilyMembers(session.user.id)
    } catch(e) { setInviteMsg({ text:e.message, err:true }) }
    finally { setInviteLoading(false) }
  }

  async function generateQR() {
    const token = randomToken()
    const { error } = await supabase.from('familien_zugang').insert({
      inhaber_id:session.user.id, mitglied_email:null, berechtigung:invitePerm, invite_token:token, aktiv:false,
    })
    if (!error) { setQrToken(`${appUrl}/join?token=${token}`); setShowQr(true); loadFamilyMembers(session.user.id) }
  }

  async function updatePermission(zugangId, newPerm) {
    await supabase.from('familien_zugang').update({ berechtigung:newPerm }).eq('id', zugangId)
    loadFamilyMembers(session.user.id)
  }

  async function revokeAccess(zugangId) {
    if (!confirm('Zugang wirklich entziehen?')) return
    await supabase.from('familien_zugang').delete().eq('id', zugangId)
    loadFamilyMembers(session.user.id)
  }

  async function saveReminder(updates) {
    const newSettings = { ...reminderSettings, ...updates, user_id:session.user.id }
    setReminderSettings(newSettings)
    const { error } = await supabase.from('reminder_settings').upsert(newSettings, { onConflict:'user_id' })
    if (error) setReminderMsg({ text:'Fehler: '+error.message, err:true })
    else setReminderMsg({ text:'Gespeichert ✓', err:false })
    setTimeout(() => setReminderMsg(null), 3000)
  }

  async function loadKontakte(uid) {
    const { data } = await supabase.from('kontakte').select('*')
      .eq('user_id', uid).order('name')
    setKontakte(data || [])
  }

  async function addNotiz() {
    if (!neueNotiz.trim() || !selectedDoc) return
    setNotizSaving(true)
    const autorName = session.user.email.split('@')[0]
    await fetch('/api/notiz', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ dokument_id:selectedDoc.id, text:neueNotiz.trim(), autor:autorName, user_id:session.user.id }),
    })
    setNeueNotiz('')
    // Reload doc
    const { data } = await supabase.from('dokumente').select('*').eq('id', selectedDoc.id).single()
    if (data) setSelectedDoc(data)
    await loadAll()
    setNotizSaving(false)
  }

  async function saveDocReminder(docId, datum) {
    if (!datum) return
    await supabase.from('dokument_reminder').insert({
      dokument_id: docId,
      user_id: session.user.id,
      erinnerung_am: datum,
      text: `Erinnerung für Dokument`,
      gesendet: false,
    })
    setDocReminder('')
  }

  async function genAnschreiben(doc) {
    setAnschreibenDoc(doc); setAnschreiben({ loading:true })
    const { data: profil } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    const res = await fetch('/api/anschreiben', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ dokument:doc, profil, kontakte }),
    })
    const data = await res.json()
    setAnschreiben(res.ok ? data : { error:data.error })
  }

  function druckAnschreiben() {
    const w = window.open('', '_blank')
    w.document.write(`<pre style="font-family:serif;font-size:14px;padding:40px;max-width:600px;white-space:pre-wrap">${anschreiben.anschreiben}</pre>`)
    w.document.close(); w.print()
  }

  function mailAnschreiben() {
    const mailto = `mailto:${anschreibenDoc?.absender_email||''}?subject=${encodeURIComponent(anschreiben.betreff||'')}&body=${encodeURIComponent(anschreiben.anschreiben||'')}`
    window.open(mailto, '_blank')
  }

  function getYear() { const s = document.getElementById('year-sel'); return s ? parseInt(s.value) : new Date().getFullYear() }

  function exportCSV(nurSteuer=true) {
    const jahr = getYear()
    const filtered = docs.filter(d => (d.jahr||new Date().getFullYear())===jahr && (!nurSteuer||d.steuerrelevant||d.kategorie==='Steuer / Finanzamt'))
    if (!filtered.length) { setExportMsg({ text:'Keine Dokumente für '+jahr, err:true }); return }
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
    if (!filtered.length) { setExportMsg({ text:'Keine steuerrelevanten Dokumente für '+jahr, err:true }); return }
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}); const W=210,pad=18; let y=pad
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(10,22,40)
    doc.text('PostScout – Steuerübersicht '+jahr,pad,y); y+=8
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(120,120,120)
    doc.text(`${new Date().toLocaleDateString('de-DE')} · ${filtered.length} Dokument(e)`,pad,y); y+=9
    doc.setDrawColor(220,220,220); doc.setLineWidth(0.3); doc.line(pad,y,W-pad,y); y+=7
    const gesamt=filtered.reduce((s,d)=>s+(Number(d.betrag)||0),0)
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(10,22,40)
    doc.text('Gesamtbetrag:',pad,y); doc.text(gesamt.toLocaleString('de-DE',{style:'currency',currency:'EUR'}),W-pad,y,{align:'right'}); y+=9
    doc.line(pad,y,W-pad,y); y+=7
    filtered.forEach((d,i)=>{
      if(y>260){doc.addPage();y=pad}
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(10,22,40)
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

  const filteredDocs = docFilter==='Alle' ? docs : docs.filter(d=>d.kategorie===docFilter)
  const jahre = [...new Set(docs.map(d=>d.jahr||new Date().getFullYear()))].sort((a,b)=>b-a)
  const openTodos = allTodos.filter(t=>!t.erledigt).length
  const urgentTodos = allTodos.filter(t=>!t.erledigt&&(t.dringlichkeit==='ueberfaellig'||t.dringlichkeit==='hoch')).length
  const isOwner = !ownerView
  const canEdit = !ownerView || myPermission==='abhaken' || myPermission==='notizen'
  const viewTitle = { todos:'Aufgaben', scan:'Scannen', archiv:'Archiv', familie:'Familie', export:'Export & Einstellungen' }

  return (
    <>
      <Head>
        <title>PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✉</text></svg>" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="shell">

        {/* ── NAVY HEADER ── */}
        <header className="top-bar">
          <button className="top-logo" onClick={session ? ()=>setView('home') : undefined}>
            <span className="top-logo-icon">✉</span>
            <span className="top-logo-text">PostScout</span>
            {view !== 'home' && session && <span className="top-logo-sub">Startseite</span>}
          </button>
          {session && (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {urgentTodos > 0 && (
                <div className="top-alert-dot" onClick={()=>setView('todos')}>{urgentTodos}</div>
              )}
              <button className="top-user" onClick={signOut}>
                <span className="top-user-icon">👤</span>
                <span className="top-user-label">{session.user.email.split('@')[0]}</span>
              </button>
            </div>
          )}
        </header>

        <div className="content">

          {/* ── AUTH ── */}
          {!session && (
            <div className="auth-wrap">
              <div className="auth-hero">
                <div className="auth-hero-icon">✉</div>
                <h1 className="auth-hero-title">PostScout</h1>
                <p className="auth-hero-sub">Briefe verstehen – nichts verpassen</p>
              </div>
              <div className="card" style={{padding:'1.5rem'}}>
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
            </div>
          )}

          {/* ── HOME ── */}
          {session && view==='home' && (
            <div>
              <div className="home-greeting">
                <span className="home-greeting-name">Guten Tag{session.user.email ? `, ${session.user.email.split('@')[0]}` : ''}.</span>
                <span className="home-greeting-sub">{ownerView?'Familienansicht':'Ihre Post im Überblick'}</span>
              </div>

              {urgentTodos > 0 && (
                <button className="alert-banner" onClick={()=>setView('todos')}>
                  <div className="alert-banner-dot"/>
                  <span><strong>{urgentTodos}</strong> dringende Aufgabe{urgentTodos!==1?'n':''}</span>
                  <span style={{marginLeft:'auto',fontSize:18}}>›</span>
                </button>
              )}
              {openTodos > 0 && urgentTodos===0 && (
                <button className="info-banner" onClick={()=>setView('todos')}>
                  <span>{openTodos} offene Aufgabe{openTodos!==1?'n':''}</span>
                  <span style={{marginLeft:'auto',fontSize:18,color:'#0A1628'}}>›</span>
                </button>
              )}
              {openTodos===0 && (
                <div className="ok-banner">✓ Alle Aufgaben erledigt</div>
              )}

              <div className="tile-grid">
                {HOME_TILES.filter(t => isOwner || t.id==='todos' || t.id==='archiv').map(tile => (
                  <button key={tile.id} className="tile" onClick={()=>tile.href ? window.location.href=tile.href : setView(tile.id)}>
                    <div className="tile-ico">{tile.ico}</div>
                    <div className="tile-label">{tile.label}</div>
                    <div className="tile-desc">{tile.desc}</div>
                    {tile.id==='todos' && openTodos>0 && (
                      <div className="tile-badge" style={{background:urgentTodos>0?'#EF4444':'#0A1628'}}>{openTodos}</div>
                    )}
                  </button>
                ))}
              </div>

              {isOwner && (
                <div className="card card-muted" style={{padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:5,color:'#0A1628'}}>📨 Per E-Mail weiterleiten</div>
                  <div style={{fontSize:12,color:'#6B7280',marginBottom:8,lineHeight:1.5}}>Briefe oder Rechnungen direkt an Ihre PostScout-Adresse senden:</div>
                  <div style={{fontFamily:'monospace',fontSize:12,background:'#F0F4FF',borderRadius:8,padding:'8px 12px',color:'#0A1628',wordBreak:'break-all'}}>
                    briefe+{session.user.id.slice(0,8)}@postscout.app
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SUB-VIEWS ── */}
          {session && view!=='home' && (
            <div>
              <div className="back-bar">
                <button className="back-btn" onClick={()=>setView('home')}>‹ Zurück</button>
                <span className="back-title">{viewTitle[view]||''}</span>
              </div>

              {/* TODOS */}
              {view==='todos' && (
                <div>
                  {mailDraft && (
                    <div className="card" style={{padding:14,marginBottom:12,background:'#EEF4FF',border:'1px solid #C7D7FA'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                        <span style={{fontSize:22}}>✉</span>
                        <div><div style={{fontSize:14,fontWeight:600,color:'#1E3A8A'}}>Antwort erforderlich</div><div style={{fontSize:12,color:'#3B5BDB'}}>E-Mail-Vorlage erstellt</div></div>
                        <button onClick={()=>setMailDraft(null)} style={{marginLeft:'auto',background:'transparent',border:'none',cursor:'pointer',fontSize:18,color:'#93C5FD'}}>✕</button>
                      </div>
                      {mailDraft.betreff&&<div style={{fontSize:12,background:'#fff',borderRadius:6,padding:'6px 10px',marginBottom:4}}><strong>Betreff:</strong> {mailDraft.betreff}</div>}
                      {mailDraft.text&&<div style={{fontSize:12,color:'#6B7280',lineHeight:1.5,background:'#fff',borderRadius:6,padding:'6px 10px',marginBottom:10}}>{mailDraft.text.slice(0,120)}{mailDraft.text.length>120?'…':''}</div>}
                      <button className="btn-primary btn-full" onClick={()=>openMail(mailDraft)}>📬 In Mail öffnen</button>
                    </div>
                  )}

                  {allTodos.length===0 ? (
                    <div className="empty"><div style={{fontSize:40,marginBottom:12}}>✅</div><p>Alle Aufgaben erledigt.</p>
                      {isOwner&&<button className="btn-ghost" onClick={()=>setView('scan')} style={{marginTop:14}}>Brief scannen →</button>}
                    </div>
                  ) : (
                    <>
                      <div className="card" style={{padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:15,fontWeight:700,color:'#0A1628'}}>{openTodos} offen</span>
                        {urgentTodos>0&&<span className="pill pill-red">{urgentTodos} dringend</span>}
                        {!canEdit&&<span className="pill pill-grey" style={{marginLeft:'auto'}}>👁 Nur-Lesen</span>}
                      </div>
                      {DRING_ORDER.filter(d=>d!=='ignorieren').map(dring => {
                        const group = allTodos.filter(t=>t.dringlichkeit===dring)
                        if (!group.length) return null
                        const d = DRING[dring]
                        return (
                          <div key={dring} style={{marginBottom:'1.25rem'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7,fontSize:12,fontWeight:700,color:d.color,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                              <div style={{width:7,height:7,borderRadius:'50%',background:d.dot,flexShrink:0}}/>
                              {d.label}
                            </div>
                            {[...group.filter(t=>t.status!=='erledigt'&&!t.erledigt),...group.filter(t=>t.status==='erledigt'||t.erledigt)].map((t,i)=>{
                              const status = t.status || (t.erledigt?'erledigt':'offen')
                              const s = TODO_STATUS[status] || TODO_STATUS.offen
                              return (
                              <div key={i} className={`todo-card ${status==='erledigt'?'todo-card-done':''}`}>
                                <button
                                  title={`Status: ${s.label} → Klick für nächsten Status`}
                                  onClick={()=>cycleTodoStatus(t.docId,t.todoIdx)}
                                  disabled={!canEdit}
                                  style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${s.color}`,flexShrink:0,marginTop:1,cursor:canEdit?'pointer':'not-allowed',
                                    background:s.bg,fontSize:11,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',
                                    opacity:!canEdit?0.4:1}}>
                                  {status==='erledigt'?'✓':status==='in_bearbeitung'?'↻':status==='wartet'?'…':''}
                                </button>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:14,color:'#0A1628',lineHeight:1.4,marginBottom:4,
                                    textDecoration:status==='erledigt'?'line-through':'none',opacity:status==='erledigt'?0.5:1}}>{t.aufgabe}</div>
                                  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                                    <span style={{fontSize:11,color:'#6B7280'}}>{t.catIco} {t.docName}</span>
                                    {t.frist&&<span style={{fontSize:11,fontWeight:600,color:dring==='ueberfaellig'?'#B91C1C':dring==='hoch'?'#C2410C':'#B45309'}}>
                                      {dring==='ueberfaellig'?'⚠ Überfällig: ':'📅 '}{new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}
                                    </span>}
                                    {status!=='offen'&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:s.bg,color:s.color,fontWeight:600,border:`1px solid ${s.color}20`}}>{s.label}</span>}
                                    {t.erledigt_von&&<span style={{fontSize:10,color:'#6B7280'}}>von {t.erledigt_von}</span>}
                                  </div>
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}

              {/* SCAN */}
              {view==='scan' && isOwner && (
                <div>
                  <div className="section-label">Fotos / Seiten</div>
                  <div className="upload-zone" onClick={()=>fileRef.current.click()}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('over')}}
                    onDragLeave={e=>e.currentTarget.classList.remove('over')} onDrop={handleDrop}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:'none'}}
                      onChange={e=>{Array.from(e.target.files).forEach(f=>addPhoto(f));e.target.value=''}}/>
                    <div style={{fontSize:32,marginBottom:8}}>📷</div>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:3,color:'#0A1628'}}>{photos.length>0?'Weitere Seite hinzufügen':'Brief oder Foto aufnehmen'}</div>
                    <div style={{fontSize:12,color:'#6B7280',marginBottom:12}}>Mehrere Seiten möglich – z.B. Vorder- und Rückseite</div>
                    <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                      <button className="btn-primary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📷 Aufnehmen</button>
                      <button className="btn-secondary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📁 Datei</button>
                    </div>
                  </div>
                  {photos.length>0&&(
                    <div className="photo-strip">
                      {photos.map((p,i)=>(
                        <div key={i} style={{position:'relative',flexShrink:0,width:72}}>
                          {p.previewUrl?<img src={p.previewUrl} style={{width:72,height:72,objectFit:'cover',borderRadius:10,border:'1px solid #E5E7EB'}} alt={`Seite ${i+1}`}/>
                            :<div style={{width:72,height:72,borderRadius:10,border:'1px solid #E5E7EB',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>📄</div>}
                          <div style={{fontSize:10,color:'#6B7280',marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{i+1}. {p.file.name.slice(0,14)}</div>
                          <button onClick={()=>removePhoto(i)} style={{position:'absolute',top:-5,right:-5,width:18,height:18,borderRadius:'50%',background:'#EF4444',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                        </div>
                      ))}
                      <button onClick={()=>fileRef.current.click()} style={{flexShrink:0,width:72,height:72,borderRadius:10,border:'1.5px dashed #D1D5DB',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#9CA3AF',fontFamily:'inherit',gap:2}}>
                        <span style={{fontSize:22}}>+</span><span style={{fontSize:11}}>Seite</span>
                      </button>
                    </div>
                  )}
                  {duplikatWarnung && (
                    <div style={{background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:12,padding:14,marginBottom:10}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#B45309',marginBottom:6}}>⚠ Mögliches Duplikat</div>
                      <div style={{fontSize:13,color:'#92400E',marginBottom:10,lineHeight:1.5}}>
                        Dieses Dokument wurde möglicherweise bereits am {new Date(duplikatWarnung.erstellt_am).toLocaleDateString('de-DE')} gespeichert:<br/>
                        <strong>{duplikatWarnung.absender}</strong>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn-secondary" style={{flex:1,fontSize:13}} onClick={()=>setDuplikatWarnung(null)}>Trotzdem speichern</button>
                        <button className="btn-primary" style={{flex:1,fontSize:13}} onClick={()=>{setDuplikatWarnung(null);setPhotos([])}}>Abbrechen</button>
                      </div>
                    </div>
                  )}
                  {scanMsg&&<div className={`msg ${scanMsg.err?'msg-err':'msg-ok'}`}>{scanMsg.text}</div>}
                  <button className="btn-primary btn-full" onClick={analyzeDoc} disabled={!photos.length||analyzing} style={{marginTop:4}}>
                    {analyzing?'Wird analysiert…':'✨ Brief analysieren'}
                  </button>
                  {analyzing&&<div style={{textAlign:'center',fontSize:12,color:'#6B7280',marginTop:8}}>Claude liest den Brief – 10–20 Sekunden</div>}
                </div>
              )}

              {/* ARCHIV */}
              {view==='archiv' && (
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
                    ? <div className="empty"><div style={{fontSize:32,marginBottom:10}}>📭</div><p>Keine Dokumente.</p></div>
                    : filteredDocs.map(d=>{
                      const cat=CATS[d.kategorie]||CATS['Sonstiges']; const dr=DRING[d.dringlichkeit]||DRING.niedrig
                      return (
                        <div key={d.id} className="card" style={{padding:14,marginBottom:10,cursor:'pointer'}} onClick={()=>setSelectedDoc(d)}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:d.zusammenfassung?10:0}}>
                            <div style={{width:36,height:36,borderRadius:9,background:cat.bg,color:cat.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{cat.ico}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:14,fontWeight:600,color:'#0A1628',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.absender||d.dateiname}</div>
                              <div style={{fontSize:11,color:'#6B7280',marginTop:2}}>
                                {d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}
                                {d.betrag!=null&&' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}
                                {d.quelle==='imap'&&' · 📧'}
                              </div>
                            </div>
                            <span className="pill" style={{background:dr.bg,color:dr.color,border:`1px solid ${dr.border}`,flexShrink:0}}>{dr.label}</span>
                          </div>
                          {d.zusammenfassung&&<p style={{fontSize:13,color:'#374151',lineHeight:1.6,marginBottom:10}}>{d.zusammenfassung}</p>}
                          {d.anhaenge?.length>0&&(
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                              {d.anhaenge.map((a,i)=>(
                                <button key={i} className="btn-ghost btn-sm" onClick={()=>downloadDoc(a.storage_path,a.name)}>📎 {a.name.slice(0,18)}</button>
                              ))}
                            </div>
                          )}
                          {isOwner&&<div style={{display:'flex',gap:8}}>
                            <button className="btn-ghost btn-sm" onClick={()=>downloadDoc(d.storage_path,d.dateiname)}>⬇ Laden</button>
                            <button className="btn-ghost btn-sm" onClick={()=>genAnschreiben(d)} style={{color:'#1E3A8A',borderColor:'#BFDBFE'}}>✉ Anschreiben</button>
                            <button className="btn-ghost btn-sm btn-danger" onClick={()=>deleteDoc(d.id,d.storage_path)}>🗑</button>
                          </div>}
                        </div>
                      )
                    })
                  }
                </div>
              )}

              {/* FAMILIE */}
              {view==='familie' && isOwner && (
                <div>
                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#0A1628',marginBottom:14}}>Familienmitglied einladen</div>
                    <div className="field-group">
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
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn-primary" style={{flex:1}} onClick={sendInvite} disabled={!inviteEmail||inviteLoading}>
                        {inviteLoading?'Wird gesendet…':'✉ Einladen'}
                      </button>
                      <button className="btn-secondary" onClick={generateQR}>QR</button>
                    </div>
                  </div>
                  {showQr&&qrToken&&(
                    <div className="card" style={{padding:16,textAlign:'center',marginBottom:10}}>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>📱 QR-Code</div>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken)}`}
                        alt="QR" style={{borderRadius:8,border:'1px solid #E5E7EB',width:180,height:180}}/>
                      <div style={{fontSize:11,color:'#6B7280',marginTop:8,wordBreak:'break-all'}}>{qrToken}</div>
                      <button className="btn-ghost btn-sm" onClick={()=>setShowQr(false)} style={{marginTop:10}}>Schließen</button>
                    </div>
                  )}
                  {familyMembers.length>0&&(
                    <div className="card" style={{padding:16}}>
                      <div style={{fontSize:15,fontWeight:700,color:'#0A1628',marginBottom:12}}>Aktueller Zugang</div>
                      {familyMembers.map(m=>(
                        <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid #F3F4F6'}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:500,color:'#0A1628',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.mitglied_email||'QR-Code-Einladung'}</div>
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,display:'inline-block',marginTop:3,background:m.aktiv?'#F0FDF4':'#FFFBEB',color:m.aktiv?'#15803D':'#92400E'}}>{m.aktiv?'✓ Aktiv':'⏳ Ausstehend'}</span>
                          </div>
                          <select style={{fontSize:12,padding:'4px 6px',borderRadius:6,border:'1px solid #E5E7EB',background:'#fff',color:'#0A1628',fontFamily:'inherit',cursor:'pointer'}}
                            value={m.berechtigung} onChange={e=>updatePermission(m.id,e.target.value)}>
                            {PERM_OPTS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                          <button className="btn-ghost btn-sm btn-danger" onClick={()=>revokeAccess(m.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EXPORT + REMINDERS */}
              {view==='export' && isOwner && (
                <div>
                  <div className="section-label">Steuerjahr</div>
                  <select className="select-input" id="year-sel">
                    {(jahre.length?jahre:[new Date().getFullYear()]).map(j=><option key={j} value={j}>{j}</option>)}
                  </select>
                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:'#0A1628'}}>🔴 PDF für Steuerberater</div>
                    <div style={{fontSize:13,color:'#6B7280',marginBottom:12,lineHeight:1.5}}>Steuerrelevante Dokumente – druckfertig mit Zusammenfassung und Fristen.</div>
                    <button className="btn-primary" onClick={exportPDF}>⬇ PDF herunterladen</button>
                  </div>
                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:'#0A1628'}}>🟢 CSV für Excel / DATEV</div>
                    <div style={{fontSize:13,color:'#6B7280',marginBottom:12,lineHeight:1.5}}>Tabellarische Übersicht aller steuerrelevanten Belege.</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <button className="btn-primary" onClick={()=>exportCSV(true)}>⬇ Steuer-CSV</button>
                      <button className="btn-secondary" onClick={()=>exportCSV(false)}>⬇ Alle</button>
                    </div>
                  </div>
                  {exportMsg&&<div className={`msg ${exportMsg.err?'msg-err':'msg-ok'}`}>{exportMsg.text}</div>}

                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#0A1628'}}>🔔 E-Mail-Reminder</div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:reminderSettings?.aktiv?14:0}}>
                      <span style={{fontSize:13,fontWeight:500,color:'#0A1628'}}>Reminder aktiviert</span>
                      <button className={`toggle-btn ${reminderSettings?.aktiv?'toggle-on':''}`} onClick={()=>saveReminder({aktiv:!reminderSettings?.aktiv})}>
                        <div className="toggle-knob"/>
                      </button>
                    </div>
                    {reminderSettings?.aktiv&&(
                      <>
                        <div className="field-group">
                          <label className="field-label">Häufigkeit</label>
                          {FREQ_OPTS.map(f=>(
                            <label key={f.value} className={`perm-opt ${reminderSettings?.frequenz===f.value?'perm-opt-active':''}`} onClick={()=>saveReminder({frequenz:f.value})}>
                              <div className={`perm-radio ${reminderSettings?.frequenz===f.value?'perm-radio-on':''}`}/><div className="perm-label">{f.label}</div>
                            </label>
                          ))}
                        </div>
                        <div className="field-group">
                          <label className="field-label">Uhrzeit</label>
                          <select className="select-input" style={{width:'100%'}} value={reminderSettings?.uhrzeit_utc??7} onChange={e=>saveReminder({uhrzeit_utc:parseInt(e.target.value)})}>
                            {[6,7,8,9,10,12,18,20].map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00 Uhr</option>)}
                          </select>
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:10,borderTop:'1px solid #F3F4F6'}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:500,color:'#0A1628'}}>Nur zeitkritische Todos</div>
                            <div style={{fontSize:11,color:'#6B7280',marginTop:2}}>Dringendes + Frist innerhalb 7 Tage</div>
                          </div>
                          <button className={`toggle-btn ${reminderSettings?.nur_dringende?'toggle-on':''}`} onClick={()=>saveReminder({nur_dringende:!reminderSettings?.nur_dringende})}>
                            <div className="toggle-knob"/>
                          </button>
                        </div>
                      </>
                    )}
                    {reminderMsg&&<div className={`msg ${reminderMsg.err?'msg-err':'msg-ok'}`} style={{marginTop:10}}>{reminderMsg.text}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DOK DETAIL MODAL ── */}
        {selectedDoc && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'flex-end'}}>
            <div style={{background:'#F4F6FA',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:460,margin:'0 auto',maxHeight:'90vh',overflowY:'auto'}}>
              {/* Header */}
              <div style={{background:'#0A1628',borderRadius:'20px 20px 0 0',padding:'16px 16px 14px',display:'flex',alignItems:'center',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{selectedDoc.absender||selectedDoc.dateiname}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>{selectedDoc.kategorie} · {new Date(selectedDoc.erstellt_am).toLocaleDateString('de-DE')}</div>
                </div>
                <button onClick={()=>setSelectedDoc(null)} style={{background:'rgba(255,255,255,0.12)',border:'none',cursor:'pointer',borderRadius:'50%',width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#fff'}}>✕</button>
              </div>

              <div style={{padding:'14px 16px 2rem'}}>
                {/* Zusammenfassung */}
                {selectedDoc.zusammenfassung && (
                  <div className="card" style={{padding:14,marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Zusammenfassung</div>
                    <p style={{fontSize:14,color:'#1F2937',lineHeight:1.6}}>{selectedDoc.zusammenfassung}</p>
                  </div>
                )}

                {/* Todos mit Status */}
                {selectedDoc.todos?.length > 0 && (
                  <div className="card" style={{padding:14,marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Aufgaben</div>
                    {selectedDoc.todos.map((t, i) => {
                      const status = t.status || (t.erledigt?'erledigt':'offen')
                      const s = TODO_STATUS[status] || TODO_STATUS.offen
                      return (
                        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:'1px solid #F3F4F6'}}>
                          <button onClick={()=>cycleTodoStatus(selectedDoc.id, i)}
                            style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${s.color}`,flexShrink:0,marginTop:1,cursor:'pointer',
                              background:s.bg,fontSize:11,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                            {status==='erledigt'?'✓':status==='in_bearbeitung'?'↻':status==='wartet'?'…':''}
                          </button>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:'#0A1628',textDecoration:status==='erledigt'?'line-through':'none',opacity:status==='erledigt'?0.5:1}}>{t.aufgabe}</div>
                            <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                              <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:s.bg,color:s.color,fontWeight:600}}>{s.label}</span>
                              {t.frist&&<span style={{fontSize:10,color:'#B45309'}}>📅 {new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}</span>}
                              {t.erledigt_von&&<span style={{fontSize:10,color:'#6B7280'}}>✓ {t.erledigt_von}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Dokument-Reminder */}
                <div className="card" style={{padding:14,marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>🔔 Erinnerung setzen</div>
                  <div style={{display:'flex',gap:8}}>
                    <input type="date" value={docReminder} onChange={e=>setDocReminder(e.target.value)} min={new Date().toISOString().split('T')[0]}
                      style={{flex:1,padding:'9px 12px',borderRadius:9,border:'1.5px solid #E5E7EB',background:'#fff',color:'#0A1628',fontSize:14,fontFamily:'inherit'}}/>
                    <button className="btn-primary" onClick={()=>saveDocReminder(selectedDoc.id, docReminder)} disabled={!docReminder} style={{padding:'9px 14px',fontSize:13}}>
                      Setzen
                    </button>
                  </div>
                </div>

                {/* Notizen */}
                <div className="card" style={{padding:14,marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Notizen</div>
                  {(selectedDoc.notizen||[]).length===0 && (
                    <div style={{fontSize:13,color:'#9CA3AF',marginBottom:10}}>Noch keine Notizen.</div>
                  )}
                  {(selectedDoc.notizen||[]).map((n,i)=>(
                    <div key={i} style={{padding:'8px 0',borderBottom:'1px solid #F3F4F6'}}>
                      <div style={{fontSize:13,color:'#1F2937',lineHeight:1.5}}>{n.text}</div>
                      <div style={{fontSize:11,color:'#6B7280',marginTop:3}}>{n.autor} · {new Date(n.erstellt_am).toLocaleDateString('de-DE')}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <input type="text" value={neueNotiz} onChange={e=>setNeueNotiz(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addNotiz()}
                      placeholder="Notiz hinzufügen…"
                      style={{flex:1,padding:'9px 12px',borderRadius:9,border:'1.5px solid #E5E7EB',background:'#fff',color:'#0A1628',fontSize:14,fontFamily:'inherit'}}/>
                    <button className="btn-primary" onClick={addNotiz} disabled={!neueNotiz.trim()||notizSaving} style={{padding:'9px 14px',fontSize:13}}>
                      {notizSaving?'…':'✓'}
                    </button>
                  </div>
                </div>

                {/* Aktionen */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn-secondary" style={{flex:1,fontSize:13}} onClick={()=>downloadDoc(selectedDoc.storage_path,selectedDoc.dateiname)}>⬇ Laden</button>
                  <button className="btn-secondary" style={{flex:1,fontSize:13,color:'#1E3A8A',borderColor:'#BFDBFE'}} onClick={()=>{setSelectedDoc(null);genAnschreiben(selectedDoc)}}>✉ Anschreiben</button>
                  <button className="btn-secondary btn-danger" style={{fontSize:13}} onClick={()=>{setSelectedDoc(null);deleteDoc(selectedDoc.id,selectedDoc.storage_path)}}>🗑</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANSCHREIBEN MODAL ── */}
        {anschreiben && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'flex-end'}}>
            <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 16px',width:'100%',maxWidth:460,margin:'0 auto',maxHeight:'85vh',overflowY:'auto'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <span style={{fontSize:16,fontWeight:700,color:'#0A1628'}}>✉ Anschreiben</span>
                <button onClick={()=>setAnschreiben(null)} style={{background:'#F3F4F6',border:'none',cursor:'pointer',borderRadius:'50%',width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#6B7280'}}>✕</button>
              </div>
              {anschreiben.loading&&<div style={{textAlign:'center',padding:'2rem',color:'#6B7280'}}>Wird generiert…</div>}
              {anschreiben.error&&<div className="msg msg-err">{anschreiben.error}</div>}
              {anschreiben.betreff&&(
                <>
                  <div className="section-label">Betreff</div>
                  <div style={{fontSize:14,fontWeight:500,marginBottom:14,padding:'10px 12px',background:'#F9FAFB',borderRadius:10,color:'#0A1628'}}>{anschreiben.betreff}</div>
                  <div className="section-label">Anschreiben</div>
                  <div style={{fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap',padding:14,background:'#F9FAFB',borderRadius:10,marginBottom:14,maxHeight:280,overflowY:'auto',color:'#1F2937'}}>{anschreiben.anschreiben}</div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn-primary" style={{flex:1}} onClick={mailAnschreiben}>📬 Per Mail</button>
                    <button className="btn-secondary" style={{flex:1}} onClick={druckAnschreiben}>🖨 Drucken</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BOTTOM NAV ── */}
        {session && view!=='home' && (
          <nav className="bottom-nav">
            {HOME_TILES.filter(t => (isOwner||t.id==='todos'||t.id==='archiv') && !t.href).map(tile=>(
              <button key={tile.id} className={`bottom-tab ${view===tile.id?'bottom-tab-active':''}`} onClick={()=>setView(tile.id)}>
                <span style={{fontSize:22,lineHeight:1}}>{tile.ico}</span>
                <span style={{fontSize:10,fontWeight:500,color:view===tile.id?'#0A1628':'#9CA3AF'}}>{tile.label}</span>
                {tile.id==='todos'&&openTodos>0&&<span className="bottom-badge" style={{background:urgentTodos>0?'#EF4444':'#0A1628'}}>{openTodos}</span>}
              </button>
            ))}
          </nav>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F4F6FA;color:#0A1628;min-height:100vh;-webkit-font-smoothing:antialiased}
        .shell{max-width:460px;margin:0 auto;min-height:100vh;background:#F4F6FA;position:relative}

        /* Navy top bar */
        .top-bar{background:#0A1628;padding:14px 16px 14px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
        .top-logo{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;padding:0;text-align:left}
        .top-logo-icon{width:34px;height:34px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .top-logo-text{font-size:17px;font-weight:700;color:#fff;letter-spacing:-0.3px}
        .top-logo-sub{font-size:11px;color:rgba(255,255,255,0.5);margin-left:4px;align-self:flex-end;margin-bottom:1px}
        .top-alert-dot{background:#EF4444;color:#fff;border-radius:20px;font-size:11px;font-weight:700;padding:3px 9px;cursor:pointer;min-width:22px;text-align:center}
        .top-user{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.12);border:none;border-radius:20px;padding:6px 12px;cursor:pointer;transition:background 140ms}
        .top-user:hover{background:rgba(255,255,255,0.2)}
        .top-user-icon{font-size:14px}
        .top-user-label{font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

        .content{padding:1.25rem 1rem 7rem}

        /* Auth */
        .auth-wrap{padding-top:1rem}
        .auth-hero{text-align:center;padding:2rem 1rem 1.5rem;background:#0A1628;margin:-1.25rem -1rem 1.5rem;padding-top:2.5rem;padding-bottom:2rem}
        .auth-hero-icon{font-size:40px;margin-bottom:10px}
        .auth-hero-title{font-size:28px;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:-0.5px}
        .auth-hero-sub{font-size:14px;color:rgba(255,255,255,0.6)}
        .auth-toggle{font-size:13px;color:#6B7280;margin-top:14px;text-align:center}
        .auth-toggle a{color:#0A1628;font-weight:500;cursor:pointer}

        /* Home */
        .home-greeting{padding:4px 0 16px}
        .home-greeting-name{display:block;font-size:22px;font-weight:800;color:#0A1628;letter-spacing:-0.4px}
        .home-greeting-sub{display:block;font-size:13px;color:#6B7280;margin-top:2px}
        .alert-banner{width:100%;display:flex;align-items:center;gap:10px;padding:13px 15px;background:#FEF2F2;border:1.5px solid #FECACA;border-radius:14px;margin-bottom:10px;cursor:pointer;font-family:inherit;font-size:14px;color:#B91C1C;text-align:left}
        .alert-banner-dot{width:8px;height:8px;border-radius:50%;background:#EF4444;flex-shrink:0;animation:pulse 1.5s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .info-banner{width:100%;display:flex;align-items:center;gap:10px;padding:13px 15px;background:#fff;border:1.5px solid #E5E7EB;border-radius:14px;margin-bottom:10px;cursor:pointer;font-family:inherit;font-size:14px;color:#374151;text-align:left}
        .ok-banner{padding:12px 15px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;font-size:14px;color:#15803D;text-align:center;margin-bottom:10px;font-weight:500}
        .tile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
        .tile{background:#fff;border:none;border-radius:16px;padding:18px 14px 14px;text-align:left;cursor:pointer;position:relative;display:flex;flex-direction:column;gap:3px;font-family:inherit;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:transform 120ms,box-shadow 120ms}
        .tile:hover{transform:scale(1.02);box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .tile:active{transform:scale(0.98)}
        .tile-ico{font-size:26px;margin-bottom:6px}
        .tile-label{font-size:15px;font-weight:700;color:#0A1628}
        .tile-desc{font-size:11px;color:#6B7280;line-height:1.4}
        .tile-badge{position:absolute;top:12px;right:12px;border-radius:20px;font-size:11px;font-weight:700;padding:2px 8px;color:#fff;min-width:22px;text-align:center}
        .card-muted{background:#F9FAFB;border:1px solid #E5E7EB}

        /* Back */
        .back-bar{display:flex;align-items:center;gap:12px;margin-bottom:1.25rem}
        .back-btn{background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:8px 14px;font-size:13px;color:#374151;cursor:pointer;font-family:inherit;font-weight:500;transition:background 120ms;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
        .back-btn:hover{background:#F9FAFB}
        .back-title{font-size:17px;font-weight:700;color:#0A1628}

        /* Cards */
        .card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}

        /* Buttons */
        .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 18px;border-radius:10px;border:none;background:#0A1628;color:#fff;font-size:14px;font-family:inherit;cursor:pointer;font-weight:600;transition:opacity 140ms,transform 100ms}
        .btn-primary:hover{opacity:0.9}
        .btn-primary:active{transform:scale(0.97)}
        .btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}
        .btn-full{width:100%;padding:14px;font-size:15px;border-radius:12px}
        .btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 18px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;color:#0A1628;font-size:14px;font-family:inherit;cursor:pointer;font-weight:600;transition:background 140ms}
        .btn-secondary:hover{background:#F9FAFB}
        .btn-ghost{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:8px;border:1px solid #E5E7EB;background:transparent;color:#374151;font-size:12px;font-family:inherit;cursor:pointer;transition:background 120ms;font-weight:500}
        .btn-ghost:hover{background:#F9FAFB}
        .btn-sm{padding:6px 10px;font-size:12px}
        .btn-danger:hover{background:#FEF2F2;color:#B91C1C;border-color:#FECACA}

        /* Fields */
        .field-group{margin-bottom:12px}
        .field-label{font-size:12px;font-weight:600;color:#6B7280;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em}
        .field-input{width:100%;padding:11px 13px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;color:#0A1628;font-size:14px;font-family:inherit;transition:border-color 150ms}
        .field-input:focus{outline:none;border-color:#0A1628}
        .select-input{padding:10px 12px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;color:#0A1628;font-size:13px;font-family:inherit;cursor:pointer;margin-bottom:12px}

        /* Section label */
        .section-label{font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px}

        /* Upload zone */
        .upload-zone{border:2px dashed #E5E7EB;border-radius:16px;padding:1.75rem 1rem;text-align:center;cursor:pointer;transition:border-color 160ms,background 160ms;margin-bottom:10px;background:#fff}
        .upload-zone:hover,.upload-zone.over{border-color:#0A1628;background:#F0F4FF}

        /* Photo strip */
        .photo-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;margin-bottom:8px;scrollbar-width:none}
        .photo-strip::-webkit-scrollbar{display:none}

        /* Todos */
        .todo-card{display:flex;align-items:flex-start;gap:11px;padding:13px 14px;background:#fff;border-radius:12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:opacity 200ms}
        .todo-card-done{opacity:0.45}
        .todo-check{width:22px;height:22px;border-radius:50%;border:2px solid #D1D5DB;flex-shrink:0;margin-top:1px;cursor:pointer;background:transparent;font-size:12px;color:#fff;display:flex;align-items:center;justify-content:center;transition:background 140ms,border-color 140ms;font-family:inherit}
        .todo-check-done{background:#15803D;border-color:#15803D}

        /* Pills */
        .pill{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid transparent}
        .pill-red{background:#FEF2F2;color:#B91C1C;border-color:#FECACA}
        .pill-grey{background:#F9FAFB;color:#6B7280;border-color:#E5E7EB}

        /* Stats */
        .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem}
        .stat-cell{background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
        .stat-lbl{font-size:11px;color:#6B7280;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
        .stat-val{font-size:24px;font-weight:800;color:#0A1628}

        /* Chips */
        .chip-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem}
        .chip{padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #E5E7EB;background:#fff;color:#374151;transition:all 110ms;font-family:inherit}
        .chip-active{background:#0A1628;color:#fff;border-color:#0A1628}

        /* Perm opts */
        .perm-opt{display:flex;align-items:flex-start;gap:10px;padding:11px;border-radius:10px;border:1.5px solid #E5E7EB;margin-bottom:8px;cursor:pointer;transition:border-color 120ms,background 120ms}
        .perm-opt-active{border-color:#0A1628;background:#F0F4FF}
        .perm-radio{width:17px;height:17px;border-radius:50%;border:2px solid #D1D5DB;flex-shrink:0;margin-top:2px;transition:all 120ms}
        .perm-radio-on{border-color:#0A1628;background:#0A1628}
        .perm-label{font-size:13px;font-weight:600;color:#0A1628}
        .perm-desc{font-size:11px;color:#6B7280;margin-top:1px}

        /* Toggle */
        .toggle-btn{width:46px;height:26px;border-radius:20px;border:none;background:#D1D5DB;cursor:pointer;position:relative;transition:background 200ms;padding:0;flex-shrink:0}
        .toggle-on{background:#0A1628}
        .toggle-knob{width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:transform 200ms;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
        .toggle-on .toggle-knob{transform:translateX(20px)}

        /* Msgs */
        .msg{border-radius:10px;padding:11px 14px;font-size:13px;margin-bottom:12px;line-height:1.5;font-weight:500}
        .msg-err{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}
        .msg-ok{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0}

        /* Empty */
        .empty{text-align:center;padding:3rem 1rem;color:#6B7280}
        .empty p{font-size:14px;font-weight:500}

        /* Bottom nav */
        .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid #F3F4F6;display:flex;z-index:100;padding:8px 0 max(8px,env(safe-area-inset-bottom))}
        .bottom-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border:none;background:transparent;cursor:pointer;position:relative;font-family:inherit}
        .bottom-tab-active .bottom-tab-ico{transform:scale(1.1)}
        .bottom-badge{position:absolute;top:2px;right:calc(50% - 20px);background:#EF4444;color:#fff;border-radius:20px;font-size:9px;font-weight:700;padding:1px 5px;min-width:16px;text-align:center}

        @media(prefers-reduced-motion:reduce){
          .tile,.todo-card,.btn-primary,.btn-secondary,.btn-ghost,.upload-zone,.chip,.todo-check,.toggle-btn,.toggle-knob{transition:none}
          @keyframes pulse{0%,100%{opacity:1}}
        }
      `}</style>
    </>
  )
}
