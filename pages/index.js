import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { supabase } from '../lib/supabase'

// ── Kategorie-Config ──────────────────────────────────────────────────────────
const CATS = {
  'Behörde / Ämter':           { ico: '🏛', bg: 'var(--ps-cat-gov-bg)',    text: 'var(--ps-cat-gov)' },
  'Gesundheit / Krankenkasse': { ico: '❤️', bg: 'var(--ps-cat-health-bg)', text: 'var(--ps-cat-health)' },
  'Finanzen / Bank':           { ico: '🏦', bg: 'var(--ps-cat-bank-bg)',   text: 'var(--ps-cat-bank)' },
  'Versicherung':              { ico: '🛡', bg: 'var(--ps-petrol-tint)',    text: 'var(--ps-petrol)' },
  'Steuer / Finanzamt':        { ico: '🧾', bg: 'var(--ps-cat-tax-bg)',    text: 'var(--ps-cat-tax)' },
  'Rechnungen / Mahnungen':    { ico: '📋', bg: 'var(--ps-urgent-bg)',     text: 'var(--ps-urgent)' },
  'Sonstiges':                 { ico: '📄', bg: 'var(--ps-subtle)',         text: 'var(--ps-muted)' },
}

const DRING_ORDER = ['ueberfaellig','hoch','mittel','niedrig','ignorieren']
const DRING = {
  ueberfaellig: { label:'Überfällig',       color:'var(--ps-overdue)',    bg:'var(--ps-overdue-bg)',    dot:'#B3402C' },
  hoch:         { label:'Dringend',          color:'var(--ps-urgent)',     bg:'var(--ps-urgent-bg)',     dot:'#C2410C' },
  mittel:       { label:'Mittelfristig',     color:'var(--ps-medium)',     bg:'var(--ps-medium-bg)',     dot:'#8A5A12' },
  niedrig:      { label:'Zur Kenntnis',      color:'var(--ps-done)',       bg:'var(--ps-done-bg)',       dot:'#2E7D46' },
  ignorieren:   { label:'Werbung',           color:'var(--ps-muted)',      bg:'var(--ps-subtle)',        dot:'#9A968B' },
}

const TODO_STATUS = {
  offen:          { label:'Offen',             next:'in_bearbeitung', color:'var(--ps-border)', bg:'transparent' },
  in_bearbeitung: { label:'In Bearbeitung',    next:'wartet',         color:'var(--ps-medium)', bg:'var(--ps-medium-bg)' },
  wartet:         { label:'Warte auf Antwort', next:'erledigt',       color:'var(--ps-inprogress)', bg:'var(--ps-inprogress-bg)' },
  erledigt:       { label:'Erledigt',          next:'offen',          color:'var(--ps-done)',   bg:'var(--ps-done-bg)' },
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
  { id:'todos',  label:'Aufgaben',  desc:'Offene Todos & Fristen',     icon:'☑' },
  { id:'scan',   label:'Scannen',   desc:'Brief fotografieren',         icon:'📷' },
  { id:'archiv', label:'Archiv',    desc:'Alle Dokumente',              icon:'🗂' },
  { id:'familie',label:'Familie',   desc:'Zugang & Einladungen',        icon:'👥' },
  { id:'export', label:'Export',    desc:'Steuerberater & CSV',         icon:'📤' },
  { id:'profil', label:'Profil',    desc:'Daten, Mieter & E-Mail',      icon:'👤', href:'/profil' },
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
  const [selectedDoc, setSelectedDoc]   = useState(null)
  const [neueNotiz, setNeueNotiz]       = useState('')
  const [notizSaving, setNotizSaving]   = useState(false)
  const [docReminder, setDocReminder]   = useState('')
  const [kontakte, setKontakte]         = useState([])
  const fileRef = useRef()
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ── Auth ──────────────────────────────────────────────────────────────────
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
      loadScanToken(session.user.id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setDocs([]); setAllTodos([]); setPhotos([]); setFamilyMembers([])
    setOwnerView(null); setView('home')
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

  // ── Data ──────────────────────────────────────────────────────────────────
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
      if (doc.dringlichkeit === 'ignorieren') return
      const cat = CATS[doc.kategorie] || CATS['Sonstiges']
      ;(doc.todos || []).forEach((t, idx) => {
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

  const [scanTokenUrl, setScanTokenUrl]     = useState(null)
  const [scanTokenLoading, setScanTokenLoading] = useState(false)

  async function loadScanToken(uid) {
    const { data } = await supabase.from('scan_tokens')
      .select('token').eq('inhaber_id', uid).eq('aktiv', true).single()
    if (data) setScanTokenUrl(`${appUrl}/scan-only?token=${data.token}`)
  }

  async function generateScanToken() {
    setScanTokenLoading(true)
    const token = randomToken() + randomToken()
    const { error } = await supabase.from('scan_tokens').insert({
      inhaber_id: session.user.id, token, label: 'Scan-Link', aktiv: true,
    })
    if (!error) setScanTokenUrl(`${appUrl}/scan-only?token=${token}`)
    setScanTokenLoading(false)
  }

  async function deactivateScanToken() {
    if (!confirm('Scan-Link wirklich deaktivieren?')) return
    await supabase.from('scan_tokens')
      .update({ aktiv: false }).eq('inhaber_id', session.user.id)
    setScanTokenUrl(null)
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
  async function loadKontakte(uid) {
    const { data } = await supabase.from('kontakte').select('*').eq('user_id', uid).order('name')
    setKontakte(data || [])
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  function addPhoto(f) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target.result
      setPhotos(prev => [...prev, { file:f, base64:url.split(',')[1],
        previewUrl:f.type.startsWith('image/')?url:null, mimeType:f.type }])
    }
    reader.readAsDataURL(f)
  }
  function removePhoto(idx) { setPhotos(prev => prev.filter((_,i)=>i!==idx)) }
  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('over')
    Array.from(e.dataTransfer.files).forEach(f=>addPhoto(f))
  }

  // ── Analyse ───────────────────────────────────────────────────────────────
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
        body:JSON.stringify({ contentParts, userId:uid }),
      })
      if (!res.ok) { const e=await res.json(); throw new Error(e.error||'Fehler') }
      const r = await res.json()
      if (r.duplikat) { setDuplikatWarnung(r.duplikat); setAnalyzing(false); return }
      const ts = Date.now(); const storagePaths = []
      for (let i=0; i<photos.length; i++) {
        const p = photos[i]; const path=`${uid}/${ts}_${i}_${p.file.name}`
        const { error:se } = await supabase.storage.from('dokumente').upload(path, p.file, { contentType:p.mimeType })
        if (se) throw new Error('Upload: '+se.message)
        storagePaths.push(path)
      }
      const { error:dbErr } = await supabase.from('dokumente').insert({
        user_id:uid, dateiname:photos.map(p=>p.file.name).join(', '),
        storage_path:storagePaths[0], mime_type:photos[0].mimeType,
        kategorie:r.kategorie, absender:r.absender, zusammenfassung:r.zusammenfassung,
        dringlichkeit:r.dringlichkeit, frist:parseFrist(r.frist),
        betrag:r.betrag, steuerrelevant:r.steuerrelevant, jahr:new Date().getFullYear(),
        todos:(r.todos||[]).map(t=>({...t,dringlichkeit:t.dringlichkeit||r.dringlichkeit,status:'offen'})),
        empfehlungen:r.empfehlungen||[], quelle:'scan', anhaenge:[],
        inhalts_hash:r.inhaltsHash||null, notizen:[],
      })
      if (dbErr) throw new Error('DB: '+dbErr.message)
      if (r.mailAntwortErforderlich&&r.mailVorlage) setMailDraft(r.mailVorlage)
      setPhotos([]); await loadAll(); setView('todos')
    } catch(e) { setScanMsg({ text:e.message, err:true }) }
    finally { setAnalyzing(false) }
  }

  function parseFrist(frist) {
    if (!frist) return null
    const p = frist.split('.'); if (p.length===3) return `${p[2]}-${p[1]}-${p[0]}`; return null
  }

  // ── Todo Status ───────────────────────────────────────────────────────────
  async function cycleTodoStatus(docId, todoIdx) {
    const canEdit = !ownerView||myPermission==='abhaken'||myPermission==='notizen'
    if (!canEdit) return
    const userId = ownerView?ownerView.ownerId:session.user.id
    const doc = docs.find(d=>d.id===docId); if (!doc) return
    const todo = doc.todos[todoIdx]
    const currentStatus = todo.status||(todo.erledigt?'erledigt':'offen')
    const nextStatus = TODO_STATUS[currentStatus]?.next||'offen'
    const autorName = session.user.email.split('@')[0]
    const newTodos = doc.todos.map((t,i) => i===todoIdx ? {
      ...t, status:nextStatus, erledigt:nextStatus==='erledigt',
      erledigt_am:nextStatus==='erledigt'?new Date().toISOString():null,
      erledigt_von:nextStatus==='erledigt'?autorName:null,
    } : t)
    await supabase.from('dokumente').update({ todos:newTodos }).eq('id', docId)
    loadDocsForUser(userId)
  }

  // ── Mail ──────────────────────────────────────────────────────────────────
  function openMail(draft) {
    window.open(`mailto:${draft.an||''}?subject=${encodeURIComponent(draft.betreff||'')}&body=${encodeURIComponent(draft.text||'')}`, '_blank')
  }

  // ── Archiv ────────────────────────────────────────────────────────────────
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

  // ── Notizen & Reminder ────────────────────────────────────────────────────
  async function addNotiz() {
    if (!neueNotiz.trim()||!selectedDoc) return
    setNotizSaving(true)
    const autorName = session.user.email.split('@')[0]
    await fetch('/api/notiz', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ dokument_id:selectedDoc.id, text:neueNotiz.trim(), autor:autorName, user_id:session.user.id }),
    })
    setNeueNotiz('')
    const { data } = await supabase.from('dokumente').select('*').eq('id', selectedDoc.id).single()
    if (data) setSelectedDoc(data)
    await loadAll(); setNotizSaving(false)
  }
  async function saveDocReminder(docId, datum) {
    if (!datum) return
    await supabase.from('dokument_reminder').insert({
      dokument_id:docId, user_id:session.user.id, erinnerung_am:datum,
      text:'Erinnerung', gesendet:false,
    })
    setDocReminder('')
  }

  // ── Anschreiben ───────────────────────────────────────────────────────────
  async function genAnschreiben(doc) {
    setAnschreibenDoc(doc); setAnschreiben({ loading:true })
    const { data:profil } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    const res = await fetch('/api/anschreiben', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ dokument:doc, profil, kontakte }),
    })
    const data = await res.json()
    setAnschreiben(res.ok?data:{ error:data.error })
  }
  function druckAnschreiben() {
    const w = window.open('', '_blank')
    w.document.write(`<pre style="font-family:serif;font-size:14px;padding:40px;max-width:600px;white-space:pre-wrap">${anschreiben.anschreiben}</pre>`)
    w.document.close(); w.print()
  }
  function mailAnschreiben() {
    window.open(`mailto:${anschreibenDoc?.absender_email||''}?subject=${encodeURIComponent(anschreiben.betreff||'')}&body=${encodeURIComponent(anschreiben.anschreiben||'')}`, '_blank')
  }

  // ── Familie ───────────────────────────────────────────────────────────────
  async function sendInvite() {
    if (!inviteEmail) return
    setInviteLoading(true); setInviteMsg(null)
    try {
      const token = randomToken()
      const { error } = await supabase.from('familien_zugang').insert({
        inhaber_id:session.user.id, mitglied_email:inviteEmail,
        berechtigung:invitePerm, invite_token:token, aktiv:false,
      })
      if (error) throw new Error(error.message)
      const emailRes = await fetch('/api/invite', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ inviteeEmail:inviteEmail, ownerName:session.user.email.split('@')[0], permission:invitePerm, inviteToken:token }),
      })
      if (!emailRes.ok) throw new Error('E-Mail-Versand fehlgeschlagen')
      setInviteMsg({ text:`Einladung an ${inviteEmail} gesendet`, err:false })
      setInviteEmail(''); loadFamilyMembers(session.user.id)
    } catch(e) { setInviteMsg({ text:e.message, err:true }) }
    finally { setInviteLoading(false) }
  }
  async function generateQR() {
    const token = randomToken()
    const { error } = await supabase.from('familien_zugang').insert({
      inhaber_id:session.user.id, mitglied_email:null,
      berechtigung:invitePerm, invite_token:token, aktiv:false,
    })
    if (!error) { setQrToken(`${appUrl}/join?token=${token}`); setShowQr(true); loadFamilyMembers(session.user.id) }
  }
  async function updatePermission(id, perm) {
    await supabase.from('familien_zugang').update({ berechtigung:perm }).eq('id', id)
    loadFamilyMembers(session.user.id)
  }
  async function revokeAccess(id) {
    if (!confirm('Zugang wirklich entziehen?')) return
    await supabase.from('familien_zugang').delete().eq('id', id)
    loadFamilyMembers(session.user.id)
  }

  // ── Reminder ──────────────────────────────────────────────────────────────
  async function saveReminder(updates) {
    const newSettings = { ...reminderSettings, ...updates, user_id:session.user.id }
    setReminderSettings(newSettings)
    await supabase.from('reminder_settings').upsert(newSettings, { onConflict:'user_id' })
    setReminderMsg({ text:'Gespeichert', err:false })
    setTimeout(()=>setReminderMsg(null), 2500)
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function getYear() { const s=document.getElementById('year-sel'); return s?parseInt(s.value):new Date().getFullYear() }
  function exportCSV(nurSteuer=true) {
    const jahr=getYear()
    const filtered=docs.filter(d=>(d.jahr||new Date().getFullYear())===jahr&&(!nurSteuer||d.steuerrelevant||d.kategorie==='Steuer / Finanzamt'))
    if (!filtered.length) { setExportMsg({ text:'Keine Dokumente für '+jahr, err:true }); return }
    const header=['Datum','Absender','Kategorie','Steuerrelevant','Betrag (EUR)','Zusammenfassung','Frist','Datei']
    const rows=filtered.map(d=>[new Date(d.erstellt_am).toLocaleDateString('de-DE'),d.absender||'',d.kategorie,d.steuerrelevant?'Ja':'Nein',d.betrag!=null?Number(d.betrag).toFixed(2):'','"'+(d.zusammenfassung||'').replace(/"/g,"''")+'"',d.frist?new Date(d.frist).toLocaleDateString('de-DE'):'',d.dateiname||''])
    const csv=[header,...rows].map(r=>r.join(';')).join('\n')
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`postscout_${nurSteuer?'steuer':'alle'}_${jahr}.csv`; a.click()
    setExportMsg({ text:`${filtered.length} Dokumente exportiert`, err:false }); setTimeout(()=>setExportMsg(null),3000)
  }
  function exportPDF() {
    const jahr=getYear()
    const filtered=docs.filter(d=>(d.jahr||new Date().getFullYear())===jahr&&(d.steuerrelevant||d.kategorie==='Steuer / Finanzamt'))
    if (!filtered.length) { setExportMsg({ text:'Keine steuerrelevanten Dokumente für '+jahr, err:true }); return }
    const { jsPDF }=window.jspdf
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}); const W=210,pad=18; let y=pad
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(31,58,82)
    doc.text('PostScout — Steuerübersicht '+jahr,pad,y); y+=8
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(124,120,110)
    doc.text(`${new Date().toLocaleDateString('de-DE')} · ${filtered.length} Dok.`,pad,y); y+=9
    doc.setDrawColor(224,221,211); doc.setLineWidth(0.3); doc.line(pad,y,W-pad,y); y+=7
    const gesamt=filtered.reduce((s,d)=>s+(Number(d.betrag)||0),0)
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(31,58,82)
    doc.text('Gesamtbetrag:',pad,y); doc.text(gesamt.toLocaleString('de-DE',{style:'currency',currency:'EUR'}),W-pad,y,{align:'right'}); y+=9
    doc.line(pad,y,W-pad,y); y+=7
    filtered.forEach((d,i)=>{
      if(y>260){doc.addPage();y=pad}
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(31,58,82)
      doc.text((i+1)+'. '+(d.absender||d.dateiname||'Unbekannt'),pad,y); y+=5
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,90,90)
      const bet=d.betrag!=null?' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):''
      doc.text(d.kategorie+' · '+new Date(d.erstellt_am).toLocaleDateString('de-DE')+bet,pad+3,y); y+=5
      if(d.zusammenfassung){const lines=doc.splitTextToSize(d.zusammenfassung,W-pad*2-3);doc.setTextColor(50,50,50);doc.text(lines,pad+3,y);y+=lines.length*4.5}
      if(d.frist){doc.setTextColor(180,100,0);doc.text('Frist: '+new Date(d.frist).toLocaleDateString('de-DE'),pad+3,y);y+=5}
      y+=4; doc.setDrawColor(239,237,230); doc.line(pad,y,W-pad,y); y+=6
    })
    doc.save('postscout_steuer_'+jahr+'.pdf')
    setExportMsg({ text:`PDF mit ${filtered.length} Dok.`, err:false }); setTimeout(()=>setExportMsg(null),3000)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredDocs=docFilter==='Alle'?docs:docs.filter(d=>d.kategorie===docFilter)
  const jahre=[...new Set(docs.map(d=>d.jahr||new Date().getFullYear()))].sort((a,b)=>b-a)
  const openTodos=allTodos.filter(t=>!t.erledigt&&t.status!=='erledigt').length
  const urgentTodos=allTodos.filter(t=>!t.erledigt&&(t.dringlichkeit==='ueberfaellig'||t.dringlichkeit==='hoch')).length
  const isOwner=!ownerView
  const canEdit=!ownerView||myPermission==='abhaken'||myPermission==='notizen'
  const viewTitle={ todos:'Aufgaben', scan:'Scannen', archiv:'Archiv', familie:'Familie', export:'Export & Einstellungen' }
  const userName=session?.user?.email?.split('@')[0]||''

  return (
    <>
      <Head>
        <title>PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="shell">

        {/* ── PETROL HEADER ── */}
        <header className="top-bar">
          <button className="top-logo" onClick={session?()=>setView('home'):undefined}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
            </svg>
            <span className="top-logo-text">PostScout</span>
            {view!=='home'&&session&&<span className="top-logo-back">← Startseite</span>}
          </button>
          {session&&(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {urgentTodos>0&&<div className="top-badge" onClick={()=>setView('todos')}>{urgentTodos}</div>}
              <button className="top-user-btn" onClick={signOut}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                <span>{userName}</span>
              </button>
            </div>
          )}
        </header>

        <div className="content">

          {/* ── AUTH ── */}
          {!session&&(
            <div className="auth-wrap">
              <div className="auth-hero">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:14}}>
                  <rect x="2" y="4" width="20" height="16" rx="3"/>
                  <path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
                </svg>
                <h1 className="auth-title">PostScout</h1>
                <p className="auth-sub">Briefe verstehen. Fristen sichern.</p>
              </div>
              <div className="auth-sheet">
                <div className="field-wrap">
                  <label className="field-label">E-Mail</label>
                  <input className="field-input" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="name@beispiel.de" autoComplete="email"/>
                </div>
                <div className="field-wrap">
                  <label className="field-label">Passwort</label>
                  <input className="field-input" type="password" value={authPw} onChange={e=>setAuthPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="Mindestens 6 Zeichen" autoComplete="current-password"/>
                </div>
                {authMsg&&<div className={`msg ${authMsg.err?'msg-err':'msg-ok'}`}>{authMsg.text}</div>}
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
          {session&&view==='home'&&(
            <div>
              {/* Petrol Hero */}
              <div className="dash-hero">
                <div className="dash-hero-label">Guten Tag, {userName}.</div>
                <div className="dash-hero-num">{openTodos}</div>
                <div className="dash-hero-sub">offene {openTodos===1?'Aufgabe':'Aufgaben'}{urgentTodos>0?` · ${urgentTodos} dringend`:''}</div>
                <div className="dash-stats">
                  <div className="dash-stat"><span className="dash-stat-num">{docs.length}</span><span className="dash-stat-lbl">Dokumente</span></div>
                  <div className="dash-stat-div"/>
                  <div className="dash-stat"><span className="dash-stat-num">{docs.filter(d=>d.steuerrelevant).length}</span><span className="dash-stat-lbl">Steuerrelevant</span></div>
                  <div className="dash-stat-div"/>
                  <div className="dash-stat"><span className="dash-stat-num">{familyMembers.filter(m=>m.aktiv).length}</span><span className="dash-stat-lbl">Familie</span></div>
                </div>
              </div>

              {/* Scan CTA */}
              {isOwner&&(
                <button className="scan-cta" onClick={()=>setView('scan')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity=".4"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>
                  Brief jetzt scannen
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:'auto'}}><path d="m9 18 6-6-6-6"/></svg>
                </button>
              )}

              {/* Tile grid */}
              <div className="overline" style={{marginBottom:10}}>Menü</div>
              <div className="menu-list">
                {HOME_TILES.filter(t=>isOwner||t.id==='todos'||t.id==='archiv').map(tile=>(
                  <button key={tile.id} className="menu-item" onClick={()=>tile.href?window.location.href=tile.href:setView(tile.id)}>
                    <div className="menu-item-ico">{tile.icon}</div>
                    <div className="menu-item-info">
                      <span className="menu-item-label">{tile.label}</span>
                      <span className="menu-item-desc">{tile.desc}</span>
                    </div>
                    {tile.id==='todos'&&openTodos>0&&<span className="menu-badge" style={{background:urgentTodos>0?'var(--ps-signal)':'var(--ps-petrol)'}}>{openTodos}</span>}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ps-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                ))}
              </div>

              {isOwner&&(
                <div className="inbound-card">
                  <div className="overline" style={{marginBottom:6}}>Per E-Mail weiterleiten</div>
                  <div className="caption" style={{marginBottom:8}}>Briefe direkt an Ihre PostScout-Adresse senden:</div>
                  <div className="inbound-addr">briefe+{session.user.id.slice(0,8)}@postscout.app</div>
                </div>
              )}
            </div>
          )}

          {/* ── SUB-VIEWS ── */}
          {session&&view!=='home'&&(
            <div>
              <div className="back-bar">
                <button className="back-chip" onClick={()=>setView('home')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Zurück
                </button>
                <span className="section-title">{viewTitle[view]||''}</span>
              </div>

              {/* TODOS */}
              {view==='todos'&&(
                <div>
                  {mailDraft&&(
                    <div className="mail-banner">
                      <div className="mail-banner-row">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ps-petrol)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/></svg>
                        <div><div style={{fontSize:13,fontWeight:700,color:'var(--ps-petrol)'}}>Antwort erforderlich</div><div className="caption">E-Mail-Vorlage erstellt</div></div>
                        <button onClick={()=>setMailDraft(null)} className="icon-close">✕</button>
                      </div>
                      {mailDraft.betreff&&<div className="mail-preview-row"><span>Betreff:</span> {mailDraft.betreff}</div>}
                      <button className="btn-primary btn-full" onClick={()=>openMail(mailDraft)} style={{marginTop:10}}>In Mail öffnen</button>
                    </div>
                  )}

                  {allTodos.length===0?(
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ps-faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
                      <p>Alle Aufgaben erledigt</p>
                      {isOwner&&<button className="btn-ghost" onClick={()=>setView('scan')}>Brief scannen</button>}
                    </div>
                  ):(
                    <>
                      <div className="todos-bar">
                        <span className="todos-count">{openTodos} offen</span>
                        {urgentTodos>0&&<span className="pill-signal">{urgentTodos} dringend</span>}
                        {!canEdit&&<span className="pill-muted" style={{marginLeft:'auto'}}>Nur-Lesen</span>}
                      </div>
                      {DRING_ORDER.filter(d=>d!=='ignorieren').map(dring=>{
                        const group=allTodos.filter(t=>t.dringlichkeit===dring)
                        if (!group.length) return null
                        const d=DRING[dring]
                        return (
                          <div key={dring} className="todo-group">
                            <div className="todo-group-hd" style={{color:d.color}}>
                              <span className="todo-dot" style={{background:d.dot}}/>
                              {d.label}
                              <span style={{marginLeft:4,fontWeight:500,color:'var(--ps-faint)'}}>
                                {group.filter(t=>!t.erledigt&&t.status!=='erledigt').length} offen
                              </span>
                            </div>
                            {[...group.filter(t=>!t.erledigt&&t.status!=='erledigt'),...group.filter(t=>t.erledigt||t.status==='erledigt')].map((t,i)=>{
                              const status=t.status||(t.erledigt?'erledigt':'offen')
                              const s=TODO_STATUS[status]||TODO_STATUS.offen
                              const done=status==='erledigt'
                              return (
                                <div key={i} className={`todo-card ${done?'todo-card-done':''}`}>
                                  <button className="todo-check-btn" onClick={()=>cycleTodoStatus(t.docId,t.todoIdx)}
                                    disabled={!canEdit} title={s.label}
                                    style={{borderColor:s.color,background:s.bg,opacity:!canEdit?0.4:1}}>
                                    {status==='erledigt'&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ps-done)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                                    {status==='in_bearbeitung'&&<span style={{fontSize:10,color:'var(--ps-medium)'}}>↻</span>}
                                    {status==='wartet'&&<span style={{fontSize:10,color:'var(--ps-inprogress)'}}>…</span>}
                                  </button>
                                  <div className="todo-body">
                                    <div className="todo-aufgabe" style={{textDecoration:done?'line-through':'none',opacity:done?0.45:1}}>{t.aufgabe}</div>
                                    <div className="todo-meta">
                                      <span>{t.catIco} {t.docName}</span>
                                      {t.frist&&<span style={{color:dring==='ueberfaellig'?'var(--ps-overdue)':dring==='hoch'?'var(--ps-urgent)':'var(--ps-medium)',fontWeight:600}}>
                                        {dring==='ueberfaellig'?'Überfällig ':''}
                                        {new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}
                                      </span>}
                                      {status!=='offen'&&<span className="pill-status" style={{color:s.color,background:s.bg}}>{s.label}</span>}
                                      {t.erledigt_von&&<span style={{color:'var(--ps-faint)'}}>{t.erledigt_von}</span>}
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
              {view==='scan'&&isOwner&&(
                <div>
                  <div className="overline" style={{marginBottom:8}}>Fotos / Seiten</div>
                  {duplikatWarnung&&(
                    <div className="warn-box">
                      <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Mögliches Duplikat</div>
                      <div className="caption" style={{marginBottom:10}}>
                        Bereits gespeichert am {new Date(duplikatWarnung.erstellt_am).toLocaleDateString('de-DE')}: <strong>{duplikatWarnung.absender}</strong>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn-secondary" style={{flex:1,fontSize:13}} onClick={()=>setDuplikatWarnung(null)}>Trotzdem speichern</button>
                        <button className="btn-primary" style={{flex:1,fontSize:13}} onClick={()=>{setDuplikatWarnung(null);setPhotos([])}}>Abbrechen</button>
                      </div>
                    </div>
                  )}
                  <div className="upload-zone" onClick={()=>fileRef.current.click()}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('over')}}
                    onDragLeave={e=>e.currentTarget.classList.remove('over')}
                    onDrop={handleDrop}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:'none'}}
                      onChange={e=>{Array.from(e.target.files).forEach(f=>addPhoto(f));e.target.value=''}}/>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ps-petrol)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:8}}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <div className="body-text" style={{fontWeight:600,marginBottom:3}}>{photos.length>0?'Weitere Seite hinzufügen':'Brief oder Foto aufnehmen'}</div>
                    <div className="caption">Mehrere Seiten möglich</div>
                    <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:12}}>
                      <button className="btn-primary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>Aufnehmen</button>
                      <button className="btn-secondary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>Datei wählen</button>
                    </div>
                  </div>
                  {photos.length>0&&(
                    <div className="photo-strip">
                      {photos.map((p,i)=>(
                        <div key={i} className="photo-thumb">
                          {p.previewUrl?<img src={p.previewUrl} className="photo-img" alt={`Seite ${i+1}`}/>:<div className="photo-pdf">📄</div>}
                          <div className="caption" style={{marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}. {p.file.name.slice(0,14)}</div>
                          <button className="photo-remove" onClick={()=>removePhoto(i)}>✕</button>
                        </div>
                      ))}
                      <button className="photo-add" onClick={()=>fileRef.current.click()}>
                        <span style={{fontSize:20,lineHeight:1}}>+</span>
                        <span className="caption">Seite</span>
                      </button>
                    </div>
                  )}
                  {scanMsg&&<div className={`msg ${scanMsg.err?'msg-err':'msg-ok'}`}>{scanMsg.text}</div>}
                  <button className="btn-primary btn-full" onClick={analyzeDoc} disabled={!photos.length||analyzing}>
                    {analyzing?'Wird analysiert…':'Brief analysieren'}
                  </button>
                  {analyzing&&<div className="caption" style={{textAlign:'center',marginTop:8}}>Claude liest den Brief — 10–20 Sekunden</div>}
                </div>
              )}

              {/* ARCHIV */}
              {view==='archiv'&&(
                <div>
                  <div className="kpi-row">
                    <div className="kpi-cell"><div className="kpi-num">{docs.length}</div><div className="kpi-lbl">Dokumente</div></div>
                    <div className="kpi-cell"><div className="kpi-num">{docs.filter(d=>d.steuerrelevant).length}</div><div className="kpi-lbl">Steuerrelevant</div></div>
                    <div className="kpi-cell"><div className="kpi-num">{openTodos}</div><div className="kpi-lbl">Offene Todos</div></div>
                  </div>
                  <div className="chip-bar">
                    {['Alle',...Object.keys(CATS)].map(c=>(
                      <button key={c} className={`chip ${docFilter===c?'chip-active':''}`} onClick={()=>setDocFilter(c)}>{c}</button>
                    ))}
                  </div>
                  {filteredDocs.length===0
                    ?<div className="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--ps-faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p>Keine Dokumente</p></div>
                    :filteredDocs.map(d=>{
                      const cat=CATS[d.kategorie]||CATS['Sonstiges']; const dr=DRING[d.dringlichkeit]||DRING.niedrig
                      return (
                        <div key={d.id} className="doc-card" onClick={()=>setSelectedDoc(d)}>
                          <div className="doc-card-row">
                            <div className="cat-chip" style={{background:cat.bg,color:cat.text}}>{cat.ico}</div>
                            <div className="doc-info">
                              <div className="doc-name">{d.absender||d.dateiname}</div>
                              <div className="doc-meta">{d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}{d.betrag!=null?' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):''}{d.quelle==='imap'?' · 📧':''}</div>
                            </div>
                            <span className="status-pill" style={{background:dr.bg,color:dr.color}}>{dr.label}</span>
                          </div>
                          {d.zusammenfassung&&<p className="doc-summary">{d.zusammenfassung}</p>}
                          {d.anhaenge?.length>0&&<div className="attach-row">{d.anhaenge.map((a,i)=><button key={i} className="attach-chip" onClick={e=>{e.stopPropagation();downloadDoc(a.storage_path,a.name)}}>📎 {a.name.slice(0,18)}</button>)}</div>}
                          {isOwner&&<div className="doc-actions" onClick={e=>e.stopPropagation()}>
                            <button className="btn-ghost btn-sm" onClick={()=>downloadDoc(d.storage_path,d.dateiname)}>Laden</button>
                            <button className="btn-ghost btn-sm" onClick={()=>{setSelectedDoc(null);genAnschreiben(d)}} style={{color:'var(--ps-petrol)',borderColor:'var(--ps-petrol-tint-bd)'}}>Anschreiben</button>
                            <button className="btn-ghost btn-sm btn-danger" onClick={()=>deleteDoc(d.id,d.storage_path)}>Löschen</button>
                          </div>}
                        </div>
                      )
                    })
                  }
                </div>
              )}

              {/* FAMILIE */}
              {view==='familie'&&isOwner&&(
                <div>
                  <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                    <div className="card-title">Familienmitglied einladen</div>
                    <div className="field-wrap" style={{marginTop:12}}>
                      <label className="field-label">E-Mail-Adresse</label>
                      <input className="field-input" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="familie@beispiel.de"/>
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Berechtigung</label>
                      {PERM_OPTS.map(p=>(
                        <label key={p.value} className={`perm-opt ${invitePerm===p.value?'perm-opt-active':''}`} onClick={()=>setInvitePerm(p.value)}>
                          <div className={`perm-radio ${invitePerm===p.value?'perm-radio-on':''}`}/>
                          <div><div className="perm-label">{p.label}</div><div className="caption">{p.desc}</div></div>
                        </label>
                      ))}
                    </div>
                    {inviteMsg&&<div className={`msg ${inviteMsg.err?'msg-err':'msg-ok'}`}>{inviteMsg.text}</div>}
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn-primary" style={{flex:1}} onClick={sendInvite} disabled={!inviteEmail||inviteLoading}>
                        {inviteLoading?'Wird gesendet…':'Per E-Mail einladen'}
                      </button>
                      <button className="btn-secondary" onClick={generateQR}>QR-Code</button>
                    </div>
                  </div>
                  {showQr&&qrToken&&(
                    <div className="card" style={{padding:'var(--ps-pad-card)',textAlign:'center',marginBottom:10}}>
                      <div className="card-title" style={{marginBottom:12}}>QR-Code</div>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken)}`} alt="QR" style={{borderRadius:8,border:'1px solid var(--ps-hairline)',width:180,height:180}}/>
                      <div className="caption" style={{marginTop:8,wordBreak:'break-all'}}>{qrToken}</div>
                      <button className="btn-ghost btn-sm" onClick={()=>setShowQr(false)} style={{marginTop:10}}>Schließen</button>
                    </div>
                  )}
                  {familyMembers.length>0&&(
                    <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                      <div className="card-title" style={{marginBottom:12}}>Aktueller Zugang</div>
                      {familyMembers.map(m=>(
                        <div key={m.id} className="member-row">
                          <div style={{flex:1,minWidth:0}}>
                            <div className="body-text" style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.mitglied_email||'QR-Code-Einladung'}</div>
                            <span className={`pill-status ${m.aktiv?'pill-done':'pill-medium'}`}>{m.aktiv?'Aktiv':'Ausstehend'}</span>
                          </div>
                          <select className="select-sm" value={m.berechtigung} onChange={e=>updatePermission(m.id,e.target.value)}>
                            {PERM_OPTS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                          <button className="btn-ghost btn-sm btn-danger" onClick={()=>revokeAccess(m.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── SCAN-ONLY MODUS ── */}
                  <div className="card" style={{padding:'var(--ps-pad-card)'}}>
                    <div className="card-title" style={{marginBottom:4}}>
                      📷 Nur-Scan-Modus
                    </div>
                    <div className="caption" style={{marginBottom:14,lineHeight:1.6}}>
                      Für Personen die nur Briefe fotografieren sollen — ohne App-Zugang, ohne Anmeldung. Der Scan landet automatisch in deinem Posteingang.
                    </div>
                    {scanTokenUrl ? (
                      <div>
                        <div style={{background:'var(--ps-petrol-tint)',border:'1px solid var(--ps-petrol-tint-bd)',borderRadius:10,padding:'10px 12px',marginBottom:12,textAlign:'center'}}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=1F3A52&data=${encodeURIComponent(scanTokenUrl)}`}
                            alt="Scan QR" style={{width:160,height:160,borderRadius:8}}
                          />
                          <div className="caption" style={{marginTop:8,wordBreak:'break-all',fontSize:11}}>{scanTokenUrl}</div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn-secondary" style={{flex:1,fontSize:13}} onClick={()=>navigator.share?.({url:scanTokenUrl})||window.open(scanTokenUrl,'_blank')}>
                            Link teilen
                          </button>
                          <button className="btn-ghost btn-sm btn-danger" onClick={deactivateScanToken}>
                            Deaktivieren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-primary btn-full" onClick={generateScanToken} disabled={scanTokenLoading}>
                        {scanTokenLoading?'Wird erstellt…':'Scan-Link erstellen'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* EXPORT */}
              {view==='export'&&isOwner&&(
                <div>
                  <div className="field-wrap">
                    <label className="field-label">Steuerjahr</label>
                    <select className="field-input" id="year-sel">
                      {(jahre.length?jahre:[new Date().getFullYear()]).map(j=><option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                  <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                    <div className="card-title">PDF für Steuerberater</div>
                    <div className="caption" style={{marginBottom:10,marginTop:4}}>Steuerrelevante Dokumente — druckfertig mit Fristen und Beträgen.</div>
                    <button className="btn-primary" onClick={exportPDF}>PDF herunterladen</button>
                  </div>
                  <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                    <div className="card-title">CSV für Excel / DATEV</div>
                    <div className="caption" style={{marginBottom:10,marginTop:4}}>Tabellarische Übersicht — direkt importierbar.</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn-primary" onClick={()=>exportCSV(true)}>Steuer-CSV</button>
                      <button className="btn-secondary" onClick={()=>exportCSV(false)}>Alle Kategorien</button>
                    </div>
                  </div>
                  {exportMsg&&<div className={`msg ${exportMsg.err?'msg-err':'msg-ok'}`}>{exportMsg.text}</div>}

                  <div className="card" style={{padding:'var(--ps-pad-card)'}}>
                    <div className="card-title" style={{marginBottom:12}}>E-Mail-Reminder</div>
                    <div className="toggle-row">
                      <span className="body-text" style={{fontWeight:600}}>Aktiviert</span>
                      <button className={`toggle-btn ${reminderSettings?.aktiv?'toggle-on':''}`} onClick={()=>saveReminder({aktiv:!reminderSettings?.aktiv})}>
                        <div className="toggle-knob"/>
                      </button>
                    </div>
                    {reminderSettings?.aktiv&&(
                      <>
                        <div className="field-wrap" style={{marginTop:12}}>
                          <label className="field-label">Häufigkeit</label>
                          {FREQ_OPTS.map(f=>(
                            <label key={f.value} className={`perm-opt ${reminderSettings?.frequenz===f.value?'perm-opt-active':''}`} onClick={()=>saveReminder({frequenz:f.value})}>
                              <div className={`perm-radio ${reminderSettings?.frequenz===f.value?'perm-radio-on':''}`}/>
                              <div className="perm-label">{f.label}</div>
                            </label>
                          ))}
                        </div>
                        <div className="field-wrap">
                          <label className="field-label">Uhrzeit</label>
                          <select className="field-input" value={reminderSettings?.uhrzeit_utc??7} onChange={e=>saveReminder({uhrzeit_utc:parseInt(e.target.value)})}>
                            {[6,7,8,9,10,12,18,20].map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00 Uhr</option>)}
                          </select>
                        </div>
                        <div className="toggle-row">
                          <div>
                            <div className="body-text" style={{fontWeight:600}}>Nur zeitkritische Todos</div>
                            <div className="caption" style={{marginTop:2}}>Dringendes + Frist ≤ 7 Tage</div>
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
        {selectedDoc&&(
          <div className="modal-overlay" onClick={()=>setSelectedDoc(null)}>
            <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-header">
                <div>
                  <div style={{fontSize:'var(--ps-fs-section)',fontWeight:'var(--ps-fw-section)',color:'var(--ps-ink)'}}>{selectedDoc.absender||selectedDoc.dateiname}</div>
                  <div className="caption">{selectedDoc.kategorie} · {new Date(selectedDoc.erstellt_am).toLocaleDateString('de-DE')}</div>
                </div>
                <button className="icon-close" onClick={()=>setSelectedDoc(null)}>✕</button>
              </div>
              <div className="modal-body">
                {selectedDoc.zusammenfassung&&(
                  <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                    <div className="overline" style={{marginBottom:6}}>Zusammenfassung</div>
                    <p className="body-text">{selectedDoc.zusammenfassung}</p>
                  </div>
                )}
                {selectedDoc.todos?.length>0&&(
                  <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                    <div className="overline" style={{marginBottom:8}}>Aufgaben</div>
                    {selectedDoc.todos.map((t,i)=>{
                      const status=t.status||(t.erledigt?'erledigt':'offen'); const s=TODO_STATUS[status]||TODO_STATUS.offen
                      return (
                        <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid var(--ps-hairline)'}}>
                          <button onClick={()=>cycleTodoStatus(selectedDoc.id,i)}
                            style={{width:20,height:20,borderRadius:'50%',border:`1.5px solid ${s.color}`,flexShrink:0,marginTop:2,cursor:'pointer',background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                            {status==='erledigt'&&<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ps-done)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                          </button>
                          <div style={{flex:1}}>
                            <div className="body-text" style={{textDecoration:status==='erledigt'?'line-through':'none',opacity:status==='erledigt'?0.45:1}}>{t.aufgabe}</div>
                            <div style={{display:'flex',gap:6,marginTop:3}}>
                              <span className="pill-status" style={{color:s.color,background:s.bg}}>{s.label}</span>
                              {t.frist&&<span className="caption" style={{color:'var(--ps-medium)'}}>📅 {new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}</span>}
                              {t.erledigt_von&&<span className="caption">{t.erledigt_von}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                  <div className="overline" style={{marginBottom:8}}>Erinnerung setzen</div>
                  <div style={{display:'flex',gap:8}}>
                    <input type="date" value={docReminder} onChange={e=>setDocReminder(e.target.value)} min={new Date().toISOString().split('T')[0]} className="field-input" style={{flex:1}}/>
                    <button className="btn-primary" onClick={()=>saveDocReminder(selectedDoc.id,docReminder)} disabled={!docReminder}>Setzen</button>
                  </div>
                </div>
                <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:10}}>
                  <div className="overline" style={{marginBottom:8}}>Notizen</div>
                  {!(selectedDoc.notizen?.length)&&<div className="caption" style={{marginBottom:10}}>Noch keine Notizen.</div>}
                  {(selectedDoc.notizen||[]).map((n,i)=>(
                    <div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--ps-hairline)'}}>
                      <div className="body-text">{n.text}</div>
                      <div className="caption">{n.autor} · {new Date(n.erstellt_am).toLocaleDateString('de-DE')}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <input type="text" value={neueNotiz} onChange={e=>setNeueNotiz(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNotiz()} placeholder="Notiz hinzufügen…" className="field-input" style={{flex:1}}/>
                    <button className="btn-primary" onClick={addNotiz} disabled={!neueNotiz.trim()||notizSaving}>{notizSaving?'…':'OK'}</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn-secondary" style={{flex:1}} onClick={()=>downloadDoc(selectedDoc.storage_path,selectedDoc.dateiname)}>Laden</button>
                  <button className="btn-secondary" style={{flex:1,color:'var(--ps-petrol)',borderColor:'var(--ps-petrol-tint-bd)'}} onClick={()=>{setSelectedDoc(null);genAnschreiben(selectedDoc)}}>Anschreiben</button>
                  <button className="btn-ghost btn-danger" onClick={()=>{setSelectedDoc(null);deleteDoc(selectedDoc.id,selectedDoc.storage_path)}}>Löschen</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANSCHREIBEN MODAL ── */}
        {anschreiben&&(
          <div className="modal-overlay" onClick={()=>setAnschreiben(null)}>
            <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-header">
                <span style={{fontSize:'var(--ps-fs-section)',fontWeight:'var(--ps-fw-section)'}}>Anschreiben</span>
                <button className="icon-close" onClick={()=>setAnschreiben(null)}>✕</button>
              </div>
              <div className="modal-body">
                {anschreiben.loading&&<div className="caption" style={{textAlign:'center',padding:'2rem'}}>Wird generiert…</div>}
                {anschreiben.error&&<div className="msg msg-err">{anschreiben.error}</div>}
                {anschreiben.betreff&&(
                  <>
                    <div className="overline" style={{marginBottom:4}}>Betreff</div>
                    <div className="card" style={{padding:'10px var(--ps-pad-card)',marginBottom:12,fontWeight:600}}>{anschreiben.betreff}</div>
                    <div className="overline" style={{marginBottom:4}}>Anschreiben</div>
                    <div className="card" style={{padding:'var(--ps-pad-card)',marginBottom:14,fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap',maxHeight:280,overflowY:'auto'}}>{anschreiben.anschreiben}</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn-primary" style={{flex:1}} onClick={mailAnschreiben}>Per Mail senden</button>
                      <button className="btn-secondary" style={{flex:1}} onClick={druckAnschreiben}>Drucken</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BOTTOM NAV ── */}
        {session&&view!=='home'&&(
          <nav className="bottom-nav">
            {HOME_TILES.filter(t=>(isOwner||t.id==='todos'||t.id==='archiv')&&!t.href).map(tile=>(
              <button key={tile.id} className={`bottom-tab ${view===tile.id?'bottom-tab-active':''}`} onClick={()=>setView(tile.id)}>
                <span className="bottom-tab-ico">{tile.icon}</span>
                <span className="bottom-tab-lbl">{tile.label}</span>
                {tile.id==='todos'&&openTodos>0&&<span className="bottom-badge" style={{background:urgentTodos>0?'var(--ps-signal)':'var(--ps-petrol)'}}>{openTodos}</span>}
              </button>
            ))}
          </nav>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');

        /* ── DESIGN TOKENS ── */
        :root {
          --ps-petrol: #1F3A52; --ps-petrol-pressed: #16304A;
          --ps-petrol-tint: #EAF0F4; --ps-petrol-tint-bd: #BBD0DE;
          --ps-bg: #FBFAF8; --ps-surface: #FFFFFF; --ps-subtle: #F4F2EC;
          --ps-ink: #1A1712; --ps-muted: #7C786E; --ps-faint: #9A968B;
          --ps-border: #E0DDD3; --ps-hairline: #EFEDE6;
          --ps-signal: #F97316;
          --ps-overdue: #B3402C; --ps-overdue-bg: #FBEAE7;
          --ps-urgent: #C2410C; --ps-urgent-bg: #FBF0E8;
          --ps-medium: #8A5A12; --ps-medium-bg: #FBF4E6;
          --ps-done: #2E7D46; --ps-done-bg: #E9F0E9;
          --ps-inprogress: #1F3A52; --ps-inprogress-bg: #EAF0F4;
          --ps-cat-tax-bg: #FBF0DC; --ps-cat-tax: #8A5A12;
          --ps-cat-gov-bg: #E8EEF4; --ps-cat-gov: #345A7A;
          --ps-cat-bank-bg: #E6F0E9; --ps-cat-bank: #2E5A3C;
          --ps-cat-health-bg: #F7E9E9; --ps-cat-health: #8A3A3A;
          --ps-font: "Figtree", system-ui, -apple-system, sans-serif;
          --ps-fs-section: 18px; --ps-fw-section: 700;
          --ps-fs-body: 15px; --ps-fw-body: 500;
          --ps-fs-caption: 13px; --ps-fw-caption: 500;
          --ps-r-chip: 11px; --ps-r-button: 14px; --ps-r-card: 16px;
          --ps-r-sheet: 30px; --ps-r-pill: 20px;
          --ps-s-4: 16px; --ps-pad-page: 24px; --ps-pad-card: 16px;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--ps-font); background: var(--ps-bg); color: var(--ps-ink); -webkit-font-smoothing: antialiased; min-height: 100vh; }

        .shell { max-width: 430px; margin: 0 auto; min-height: 100vh; background: var(--ps-bg); position: relative; }
        .content { padding: 16px var(--ps-pad-page) 90px; }

        /* Typography */
        .overline { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ps-faint); }
        .caption { font-size: var(--ps-fs-caption); font-weight: var(--ps-fw-caption); color: var(--ps-muted); }
        .body-text { font-size: var(--ps-fs-body); font-weight: var(--ps-fw-body); color: var(--ps-ink); }
        .section-title { font-size: var(--ps-fs-section); font-weight: var(--ps-fw-section); color: var(--ps-ink); }
        .card-title { font-size: var(--ps-fs-section); font-weight: var(--ps-fw-section); color: var(--ps-ink); }

        /* Header */
        .top-bar { background: var(--ps-petrol); padding: 14px var(--ps-pad-page); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
        .top-logo { display: flex; align-items: center; gap: 9px; background: none; border: none; cursor: pointer; padding: 0; color: white; }
        .top-logo-text { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .top-logo-back { font-size: 11px; color: rgba(255,255,255,0.45); margin-left: 4px; align-self: flex-end; margin-bottom: 1px; }
        .top-badge { background: var(--ps-signal); color: #fff; border-radius: 20px; font-size: 11px; font-weight: 700; padding: 3px 9px; cursor: pointer; }
        .top-user-btn { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.12); border: none; border-radius: 20px; padding: 6px 12px; cursor: pointer; color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 600; font-family: inherit; }

        /* Auth */
        .auth-wrap { }
        .auth-hero { background: var(--ps-petrol); margin: -16px -24px 0; padding: 48px 24px 40px; text-align: center; border-radius: 0 0 var(--ps-r-sheet) var(--ps-r-sheet); }
        .auth-title { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 6px; letter-spacing: -0.5px; }
        .auth-sub { font-size: 14px; color: rgba(255,255,255,0.55); }
        .auth-sheet { background: var(--ps-surface); border-radius: var(--ps-r-card); padding: var(--ps-pad-card); margin-top: 20px; border: 1px solid var(--ps-hairline); }
        .auth-toggle { font-size: 13px; color: var(--ps-faint); margin-top: 14px; text-align: center; }
        .auth-toggle a { color: var(--ps-petrol); font-weight: 600; cursor: pointer; }

        /* Dashboard */
        .dash-hero { background: var(--ps-petrol); margin: -16px -24px 20px; padding: 28px 24px 24px; border-radius: 0 0 var(--ps-r-sheet) var(--ps-r-sheet); }
        .dash-hero-label { font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 8px; }
        .dash-hero-num { font-size: 54px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -2px; }
        .dash-hero-sub { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; margin-bottom: 20px; }
        .dash-stats { display: flex; align-items: center; gap: 0; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; }
        .dash-stat { flex: 1; text-align: center; }
        .dash-stat-num { font-size: 20px; font-weight: 700; color: #fff; display: block; }
        .dash-stat-lbl { font-size: 11px; color: rgba(255,255,255,0.45); display: block; margin-top: 2px; }
        .dash-stat-div { width: 1px; height: 32px; background: rgba(255,255,255,0.15); margin: 0 8px; }

        /* Scan CTA */
        .scan-cta { width: 100%; display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--ps-surface); border: 1px solid var(--ps-hairline); border-radius: var(--ps-r-card); cursor: pointer; font-size: 15px; font-weight: 600; color: var(--ps-petrol); margin-bottom: 20px; font-family: inherit; transition: background 120ms; }
        .scan-cta:hover { background: var(--ps-petrol-tint); }

        /* Menu list */
        .menu-list { background: var(--ps-surface); border-radius: var(--ps-r-card); overflow: hidden; border: 1px solid var(--ps-hairline); margin-bottom: 16px; }
        .menu-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: transparent; border: none; border-bottom: 1px solid var(--ps-hairline); cursor: pointer; font-family: inherit; transition: background 100ms; }
        .menu-item:last-child { border-bottom: none; }
        .menu-item:hover { background: var(--ps-subtle); }
        .menu-item-ico { font-size: 20px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--ps-petrol-tint); border-radius: var(--ps-r-chip); }
        .menu-item-info { flex: 1; text-align: left; }
        .menu-item-label { display: block; font-size: 15px; font-weight: 600; color: var(--ps-ink); }
        .menu-item-desc { display: block; font-size: 12px; color: var(--ps-faint); margin-top: 1px; }
        .menu-badge { background: var(--ps-petrol); color: #fff; border-radius: 20px; font-size: 11px; font-weight: 700; padding: 2px 8px; }

        /* Inbound card */
        .inbound-card { background: var(--ps-surface); border: 1px solid var(--ps-hairline); border-radius: var(--ps-r-card); padding: var(--ps-pad-card); margin-top: 4px; }
        .inbound-addr { font-size: 13px; font-family: monospace; background: var(--ps-petrol-tint); border-radius: 8px; padding: 8px 12px; color: var(--ps-petrol); font-weight: 600; word-break: break-all; }

        /* Back bar */
        .back-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .back-chip { display: flex; align-items: center; gap: 4px; background: var(--ps-surface); border: 1px solid var(--ps-border); border-radius: var(--ps-r-pill); padding: 7px 13px; font-size: 13px; font-weight: 600; color: var(--ps-ink); cursor: pointer; font-family: inherit; transition: background 100ms; }
        .back-chip:hover { background: var(--ps-subtle); }

        /* Cards */
        .card { background: var(--ps-surface); border-radius: var(--ps-r-card); border: 1px solid var(--ps-hairline); }

        /* Buttons */
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 18px; border-radius: var(--ps-r-button); border: none; background: var(--ps-petrol); color: #fff; font-size: 15px; font-family: inherit; cursor: pointer; font-weight: 600; transition: background 120ms, transform 80ms; }
        .btn-primary:hover { background: var(--ps-petrol-pressed); }
        .btn-primary:active { transform: scale(0.97); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .btn-full { width: 100%; padding: 13px; border-radius: var(--ps-r-button); font-size: 16px; }
        .btn-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 18px; border-radius: var(--ps-r-button); border: 1.5px solid var(--ps-border); background: var(--ps-surface); color: var(--ps-ink); font-size: 15px; font-family: inherit; cursor: pointer; font-weight: 600; transition: background 120ms; }
        .btn-secondary:hover { background: var(--ps-subtle); }
        .btn-ghost { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: var(--ps-r-chip); border: 1px solid var(--ps-border); background: transparent; color: var(--ps-muted); font-size: 13px; font-family: inherit; cursor: pointer; font-weight: 500; transition: background 100ms; }
        .btn-ghost:hover { background: var(--ps-subtle); }
        .btn-sm { padding: 6px 10px; font-size: 12px; }
        .btn-danger:hover { background: var(--ps-overdue-bg); color: var(--ps-overdue); border-color: #f5c0b6; }

        /* Fields */
        .field-wrap { margin-bottom: 12px; }
        .field-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ps-faint); display: block; margin-bottom: 6px; }
        .field-input { width: 100%; padding: 11px 13px; border-radius: var(--ps-r-chip); border: 1.5px solid var(--ps-border); background: var(--ps-subtle); color: var(--ps-ink); font-size: 15px; font-family: inherit; font-weight: 500; transition: border-color 150ms, background 150ms; }
        .field-input:focus { outline: none; border-color: var(--ps-petrol); background: var(--ps-surface); }

        /* Upload zone */
        .upload-zone { border: 2px dashed var(--ps-border); border-radius: var(--ps-r-card); padding: 28px 16px; text-align: center; cursor: pointer; transition: border-color 150ms, background 150ms; margin-bottom: 12px; background: var(--ps-surface); }
        .upload-zone:hover, .upload-zone.over { border-color: var(--ps-petrol); background: var(--ps-petrol-tint); }

        /* Photo strip */
        .photo-strip { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 10px; margin-bottom: 10px; scrollbar-width: none; }
        .photo-strip::-webkit-scrollbar { display: none; }
        .photo-thumb { position: relative; flex-shrink: 0; width: 72px; }
        .photo-img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; border: 1px solid var(--ps-hairline); }
        .photo-pdf { width: 72px; height: 72px; border-radius: 10px; border: 1px solid var(--ps-hairline); background: var(--ps-subtle); display: flex; align-items: center; justify-content: center; font-size: 24px; }
        .photo-remove { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 50%; background: var(--ps-overdue); color: #fff; border: none; cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; }
        .photo-add { flex-shrink: 0; width: 72px; height: 72px; border-radius: 10px; border: 1.5px dashed var(--ps-border); background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--ps-faint); font-family: inherit; gap: 3px; transition: background 100ms; }
        .photo-add:hover { background: var(--ps-subtle); }

        /* Todos */
        .todos-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 10px 14px; background: var(--ps-surface); border-radius: var(--ps-r-card); border: 1px solid var(--ps-hairline); }
        .todos-count { font-size: 16px; font-weight: 700; color: var(--ps-ink); }
        .todo-group { margin-bottom: 20px; }
        .todo-group-hd { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.04em; }
        .todo-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .todo-card { display: flex; align-items: flex-start; gap: 11px; padding: 12px 14px; background: var(--ps-surface); border-radius: var(--ps-r-card); border: 1px solid var(--ps-hairline); margin-bottom: 6px; transition: opacity 180ms; }
        .todo-card-done { opacity: 0.4; }
        .todo-check-btn { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid; flex-shrink: 0; margin-top: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 120ms, border-color 120ms; font-family: inherit; }
        .todo-body { flex: 1; min-width: 0; }
        .todo-aufgabe { font-size: 14px; font-weight: 500; color: var(--ps-ink); line-height: 1.4; margin-bottom: 4px; }
        .todo-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--ps-faint); }

        /* Pills */
        .pill-signal { background: var(--ps-urgent-bg); color: var(--ps-urgent); border-radius: var(--ps-r-pill); font-size: 12px; font-weight: 600; padding: 2px 10px; }
        .pill-muted { background: var(--ps-subtle); color: var(--ps-muted); border-radius: var(--ps-r-pill); font-size: 12px; font-weight: 600; padding: 2px 10px; }
        .pill-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--ps-r-pill); }
        .pill-done { background: var(--ps-done-bg); color: var(--ps-done); }
        .pill-medium { background: var(--ps-medium-bg); color: var(--ps-medium); }

        /* KPI row */
        .kpi-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 16px; }
        .kpi-cell { background: var(--ps-surface); border-radius: var(--ps-r-card); padding: 12px; border: 1px solid var(--ps-hairline); }
        .kpi-num { font-size: 24px; font-weight: 800; color: var(--ps-ink); }
        .kpi-lbl { font-size: 11px; color: var(--ps-faint); margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Chip bar */
        .chip-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
        .chip { padding: 5px 12px; border-radius: var(--ps-r-pill); font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid var(--ps-border); background: var(--ps-surface); color: var(--ps-muted); transition: all 100ms; font-family: inherit; }
        .chip-active { background: var(--ps-petrol); color: #fff; border-color: var(--ps-petrol); }

        /* Doc cards */
        .doc-card { background: var(--ps-surface); border-radius: var(--ps-r-card); border: 1px solid var(--ps-hairline); padding: var(--ps-pad-card); margin-bottom: 10px; cursor: pointer; transition: background 100ms; }
        .doc-card:hover { background: var(--ps-subtle); }
        .doc-card-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
        .cat-chip { width: 36px; height: 36px; border-radius: var(--ps-r-chip); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .doc-info { flex: 1; min-width: 0; }
        .doc-name { font-size: 14px; font-weight: 700; color: var(--ps-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-meta { font-size: 11px; color: var(--ps-faint); margin-top: 2px; }
        .doc-summary { font-size: 13px; color: var(--ps-muted); line-height: 1.6; margin-bottom: 10px; }
        .status-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: var(--ps-r-pill); flex-shrink: 0; white-space: nowrap; }
        .doc-actions { display: flex; gap: 6px; margin-top: 10px; }
        .attach-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .attach-chip { padding: 4px 10px; border-radius: var(--ps-r-pill); font-size: 11px; border: 1px solid var(--ps-border); background: var(--ps-subtle); color: var(--ps-muted); cursor: pointer; font-family: inherit; }

        /* Perm opts */
        .perm-opt { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: var(--ps-r-chip); border: 1.5px solid var(--ps-border); margin-bottom: 7px; cursor: pointer; transition: border-color 120ms, background 120ms; }
        .perm-opt-active { border-color: var(--ps-petrol); background: var(--ps-petrol-tint); }
        .perm-radio { width: 17px; height: 17px; border-radius: 50%; border: 2px solid var(--ps-border); flex-shrink: 0; margin-top: 2px; transition: all 120ms; }
        .perm-radio-on { border-color: var(--ps-petrol); background: var(--ps-petrol); }
        .perm-label { font-size: 14px; font-weight: 600; color: var(--ps-ink); }

        /* Member row */
        .member-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--ps-hairline); }
        .member-row:last-child { border-bottom: none; }
        .select-sm { font-size: 12px; padding: 4px 8px; border-radius: var(--ps-r-chip); border: 1px solid var(--ps-border); background: var(--ps-surface); color: var(--ps-ink); font-family: inherit; cursor: pointer; }

        /* Toggle */
        .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--ps-hairline); margin-top: 6px; gap: 12px; }
        .toggle-btn { width: 44px; height: 25px; border-radius: 20px; border: none; background: var(--ps-border); cursor: pointer; position: relative; transition: background 180ms; padding: 0; flex-shrink: 0; }
        .toggle-on { background: var(--ps-petrol); }
        .toggle-knob { width: 19px; height: 19px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform 180ms; box-shadow: 0 1px 3px rgba(0,0,0,0.18); }
        .toggle-on .toggle-knob { transform: translateX(19px); }

        /* Msgs */
        .msg { border-radius: var(--ps-r-chip); padding: 10px 13px; font-size: 13px; margin-bottom: 10px; font-weight: 500; }
        .msg-err { background: var(--ps-overdue-bg); color: var(--ps-overdue); border: 1px solid #f5c0b6; }
        .msg-ok { background: var(--ps-done-bg); color: var(--ps-done); border: 1px solid #b8d9c0; }

        /* Warn box */
        .warn-box { background: var(--ps-medium-bg); border: 1px solid #e8c87a; border-radius: var(--ps-r-card); padding: var(--ps-pad-card); margin-bottom: 12px; }

        /* Empty */
        .empty-state { text-align: center; padding: 3rem 1rem; color: var(--ps-faint); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .empty-state p { font-size: 14px; font-weight: 500; }

        /* Mail banner */
        .mail-banner { background: var(--ps-petrol-tint); border: 1px solid var(--ps-petrol-tint-bd); border-radius: var(--ps-r-card); padding: var(--ps-pad-card); margin-bottom: 12px; }
        .mail-banner-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .mail-preview-row { font-size: 12px; color: var(--ps-muted); background: var(--ps-surface); border-radius: 8px; padding: 8px 10px; margin-bottom: 4px; }
        .mail-preview-row span { font-weight: 700; color: var(--ps-ink); }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(26,23,18,0.55); z-index: 200; display: flex; align-items: flex-end; }
        .modal-sheet { background: var(--ps-bg); border-radius: var(--ps-r-sheet) var(--ps-r-sheet) 0 0; width: 100%; max-width: 430px; margin: 0 auto; max-height: 90vh; overflow-y: auto; }
        .modal-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--ps-border); margin: 12px auto 0; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px var(--ps-pad-page) 12px; border-bottom: 1px solid var(--ps-hairline); }
        .modal-body { padding: 16px var(--ps-pad-page) 32px; }
        .icon-close { background: var(--ps-subtle); border: none; cursor: pointer; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--ps-muted); flex-shrink: 0; }

        /* Bottom nav */
        .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: rgba(255,255,255,0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-top: 1px solid var(--ps-hairline); display: flex; z-index: 100; padding: 6px 0 max(6px,env(safe-area-inset-bottom)); }
        .bottom-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border: none; background: transparent; cursor: pointer; position: relative; font-family: inherit; }
        .bottom-tab-ico { font-size: 20px; line-height: 1; }
        .bottom-tab-lbl { font-size: 10px; font-weight: 600; color: var(--ps-faint); }
        .bottom-tab-active .bottom-tab-lbl { color: var(--ps-petrol); }
        .bottom-tab-active .bottom-tab-ico { transform: scale(1.1); }
        .bottom-badge { position: absolute; top: 2px; right: calc(50% - 20px); background: var(--ps-signal); color: #fff; border-radius: 20px; font-size: 9px; font-weight: 700; padding: 1px 5px; }

        @media(prefers-reduced-motion:reduce) {
          .todo-card, .btn-primary, .btn-secondary, .btn-ghost, .upload-zone, .chip, .toggle-btn, .toggle-knob, .menu-item, .doc-card { transition: none; }
        }
      `}</style>
    </>
  )
}
