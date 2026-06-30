import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import { supabase } from '../lib/supabase'

// ── Kategorie-Config ──────────────────────────────────────────────────────────
const CATS = {
  'Behörde / Ämter':           { ico: '🏛', bg: '#E8EEF4', text: '#345A7A' },
  'Gesundheit / Krankenkasse': { ico: '❤️', bg: '#F7E9E9', text: '#8A3A3A' },
  'Finanzen / Bank':           { ico: '🏦', bg: '#E6F0E9', text: '#2E5A3C' },
  'Versicherung':              { ico: '🛡', bg: '#EAF0F4', text: '#1F3A52' },
  'Steuer / Finanzamt':        { ico: '🧾', bg: '#FBF0DC', text: '#8A5A12' },
  'Rechnungen / Mahnungen':    { ico: '📋', bg: '#FBF0E8', text: '#C2410C' },
  'Sonstiges':                 { ico: '📄', bg: '#F4F2EC', text: '#7C786E' },
}

const DRING_ORDER = ['ueberfaellig','hoch','mittel','niedrig','ignorieren']
const DRING = {
  ueberfaellig: { label:'Überfällig',   color:'#B3402C', bg:'#FBEAE7', dot:'#EF4444' },
  hoch:         { label:'Dringend',     color:'#C2410C', bg:'#FBF0E8', dot:'#F97316' },
  mittel:       { label:'Mittelfristig',color:'#8A5A12', bg:'#FBF4E6', dot:'#8A5A12' },
  niedrig:      { label:'Zur Kenntnis', color:'#2E7D46', bg:'#E9F0E9', dot:'#34A853' },
  ignorieren:   { label:'Werbung',      color:'#7C786E', bg:'#F4F2EC', dot:'#9A968B' },
}

const TODO_STATUS = {
  offen:          { label:'Offen',             next:'in_bearbeitung', color:'#C8C4B8', bg:'transparent' },
  in_bearbeitung: { label:'In Bearbeitung',    next:'wartet',         color:'#8A5A12', bg:'#FBF4E6' },
  wartet:         { label:'Warte auf Antwort', next:'erledigt',       color:'#1F3A52', bg:'#EAF0F4' },
  erledigt:       { label:'Erledigt',          next:'offen',          color:'#2E7D46', bg:'#E9F0E9' },
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

function randomToken() { return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2) }

// ── SVG Icons (Lucide-Stil, strokeWidth 1.6, round) ──────────────────────────
const Icon = ({ d, size=22, sw=1.6, color='currentColor', children, viewBox='0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    {children || <path d={d}/>}
  </svg>
)

const Icons = {
  mail:    <Icon size={22}><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/></Icon>,
  bell:    <Icon size={22}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Icon>,
  tasks:   <Icon size={22}><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></Icon>,
  camera:  <Icon size={22}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13.5" r="3.2"/></Icon>,
  archive: <Icon size={22}><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z"/></Icon>,
  users:   <Icon size={22}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.5a4 4 0 0 1 0 7"/></Icon>,
  upload:  <Icon size={22}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v13"/></Icon>,
  user:    <Icon size={22}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>,
  chevron: <Icon size={18} sw={1.8}><path d="m9 18 6-6-6-6"/></Icon>,
  back:    <Icon size={18} sw={1.8}><path d="m15 18-6-6 6-6"/></Icon>,
  search:  <Icon size={20}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Icon>,
  check:   <Icon size={10} sw={2.5}><path d="M20 6 9 17l-5-5"/></Icon>,
  trash:   <Icon size={18}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Icon>,
  sparkle: <Icon size={20}><path d="M5 3v4"/><path d="M3 5h4"/><path d="M6 17v4"/><path d="M4 19h4"/><path d="m13 3 2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5Z"/></Icon>,
  calendar:<Icon size={18}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></Icon>,
  download:<Icon size={18}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></Icon>,
  qr:      <Icon size={18} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 14v4h4v-4z" opacity=".5"/></Icon>,
  menu:    <Icon size={22} sw={1.8}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>,
  home:    <Icon size={22}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></Icon>,
  contact: <Icon size={22}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>,
}

// ── NAV TABS ─────────────────────────────────────────────────────────────────
const NAV_TABS = [
  { id:'home',   label:'Start',    icon: Icons.home   },
  { id:'scan',   label:'Scannen',  icon: Icons.camera },
  { id:'archiv', label:'Archiv',   icon: Icons.archive},
  { id:'familie',label:'Familie',  icon: Icons.users  },
  { id:'export', label:'Export',   icon: Icons.upload },
]

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
  const [menuOpen, setMenuOpen]               = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({ ueberfaellig:false, hoch:false, mittel:true, niedrig:true })
  const [profVorname, setProfVorname]         = useState('')
  const [profNachname, setProfNachname]       = useState('')
  const [profAnrede, setProfAnrede]           = useState('du')
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
    loadMyProfile(session.user.id)
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

  async function loadMyProfile(uid) {
    const { data } = await supabase.from('profiles').select('vorname,nachname,anrede').eq('id', uid).single()
    if (data) {
      setProfVorname(data.vorname || '')
      setProfNachname(data.nachname || '')
      setProfAnrede(data.anrede || 'du')
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
      const form = new FormData()
      for (const p of photos) {
        const mimeType = p.mimeType || (p.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
        const blob = p.file.type ? p.file : new Blob([p.file], { type: mimeType })
        form.append('files', blob, p.file.name || `scan_${Date.now()}.jpg`)
      }
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: form,
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Fehler') }
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
  const emailPrefix=session?.user?.email?.split('@')[0]||''
  const fullName=profVorname?[profVorname,profNachname].filter(Boolean).join(' '):emailPrefix
  const greeting=(profAnrede==='Herr'||profAnrede==='Frau')
    ?(profNachname?`${profAnrede} ${profNachname}`:profVorname||emailPrefix)
    :(profVorname||emailPrefix)

  function toggleGroup(key) { setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] })) }

  const showBottomNav = !!session

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="shell">

        {/* ── HEADER ── */}
        <header className="top-bar">
          {view !== 'home' && session ? (
            <button className="top-back-btn" onClick={() => setView('home')}>
              {Icons.back}
            </button>
          ) : session ? (
            <button className="top-back-btn" onClick={() => setMenuOpen(true)} title="Menü">
              {Icons.menu}
            </button>
          ) : (
            <span style={{width:36}} />
          )}
          <button className="top-logo" onClick={session ? () => setView('home') : undefined}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
            </svg>
            <span className="top-logo-text">PostScout</span>
          </button>
          {session ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {urgentTodos > 0 && (
                <div className="top-badge" onClick={() => setView('todos')}>{urgentTodos}</div>
              )}
              <button className="top-user-btn" onClick={signOut} title="Abmelden">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <span>{fullName}</span>
              </button>
            </div>
          ) : <span style={{width:34}} />}
        </header>

        <div className="content">

          {/* ── AUTH ── */}
          {!session && (
            <div className="auth-wrap">
              <div className="auth-hero">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(251,250,248,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:20}}>
                  <rect x="2" y="4" width="20" height="16" rx="3"/>
                  <path d="m2 7 9.1 5.7a1.8 1.8 0 0 0 1.8 0L22 7"/>
                </svg>
                <h1 className="auth-title">PostScout</h1>
                <p className="auth-sub">Ihre Post — analysiert,<br/>sortiert, nie wieder verpasst.</p>
              </div>
              <div className="auth-sheet">
                <div className="field-wrap">
                  <label className="field-label">E-Mail</label>
                  <input className="field-input" type="email" value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAuth()}
                    placeholder="name@beispiel.de" autoComplete="email" />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Passwort</label>
                  <input className="field-input" type="password" value={authPw}
                    onChange={e => setAuthPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAuth()}
                    placeholder="Mindestens 6 Zeichen" autoComplete="current-password" />
                </div>
                {authMsg && <div className={`msg ${authMsg.err ? 'msg-err' : 'msg-ok'}`}>{authMsg.text}</div>}
                <button className="btn-primary btn-full" onClick={handleAuth} disabled={authLoading}>
                  {authLoading ? 'Bitte warten…' : authMode === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
                <div className="auth-toggle">
                  {authMode === 'login' ? 'Noch kein Konto? ' : 'Bereits registriert? '}
                  <a onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthMsg(null) }}>
                    {authMode === 'login' ? 'Registrieren' : 'Anmelden'}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── HOME / DASHBOARD ── */}
          {session && view === 'home' && (
            <div>
              {/* Hero */}
              <div className="dash-hero">
                <div className="dash-hero-label">Guten Tag, {greeting}.</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:12,marginTop:0}}>
                  <span className="dash-hero-num">{urgentTodos > 0 ? urgentTodos : openTodos}</span>
                  <span className="dash-hero-sub">{urgentTodos > 0 ? 'dringende Aufgaben' : `offene ${openTodos === 1 ? 'Aufgabe' : 'Aufgaben'}`}</span>
                </div>
                <div className="dash-stats">
                  <div className="dash-stat">
                    <span className="dash-stat-num">{openTodos}</span>
                    <span className="dash-stat-lbl">Offen</span>
                  </div>
                  <div className="dash-stat-div"/>
                  <div className="dash-stat">
                    <span className="dash-stat-num">{allTodos.filter(t=>t.erledigt||t.status==='erledigt').length}</span>
                    <span className="dash-stat-lbl">Erledigt</span>
                  </div>
                  <div className="dash-stat-div"/>
                  <div className="dash-stat">
                    <span className="dash-stat-num">{docs.length}</span>
                    <span className="dash-stat-lbl">Dokumente</span>
                  </div>
                </div>
              </div>

              {/* Scan CTA */}
              {isOwner && (
                <button className="scan-cta" onClick={() => setView('scan')}>
                  {Icons.camera}
                  <span>Brief scannen</span>
                  {Icons.chevron}
                </button>
              )}

              {/* Inline task list with collapsible groups */}
              {mailDraft && (
                <div className="mail-banner">
                  <div className="mail-banner-row">
                    {Icons.mail}
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#1F3A52'}}>Antwort erforderlich</div>
                      <div className="caption">E-Mail-Vorlage erstellt</div>
                    </div>
                    <button onClick={() => setMailDraft(null)} className="icon-close">✕</button>
                  </div>
                  {mailDraft.betreff && <div className="mail-preview-row"><span>Betreff:</span> {mailDraft.betreff}</div>}
                  <button className="btn-primary btn-full" onClick={() => openMail(mailDraft)} style={{marginTop:10}}>In Mail öffnen</button>
                </div>
              )}

              {allTodos.length === 0 ? (
                <div className="empty-state">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4B8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
                  <p>Alle Aufgaben erledigt</p>
                  {isOwner && <button className="btn-ghost" onClick={() => setView('scan')}>Brief scannen</button>}
                </div>
              ) : (
                <>
                  <div className="todos-bar">
                    <span className="todos-count">{openTodos} offen</span>
                    {urgentTodos > 0 && <span className="pill-signal">{urgentTodos} dringend</span>}
                    {!canEdit && <span className="pill-muted" style={{marginLeft:'auto'}}>Nur-Lesen</span>}
                  </div>
                  {DRING_ORDER.filter(d => d !== 'ignorieren').map(dring => {
                    const group = allTodos.filter(t => t.dringlichkeit === dring)
                    if (!group.length) return null
                    const d = DRING[dring]
                    const open = group.filter(t => !t.erledigt && t.status !== 'erledigt')
                    const done = group.filter(t =>  t.erledigt || t.status === 'erledigt')
                    const isCollapsed = !!collapsedGroups[dring]
                    return (
                      <div key={dring} className="todo-group">
                        <button className="todo-group-toggle" onClick={() => toggleGroup(dring)}>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            <span className="todo-dot" style={{background:d.dot}}/>
                            <span style={{color:d.color,fontWeight:700,fontSize:11,letterSpacing:'0.06em',textTransform:'uppercase'}}>{d.label}</span>
                            <span style={{fontWeight:500,color:'#9A968B',fontSize:11}}>{open.length} offen</span>
                          </div>
                          <span style={{display:'flex',color:'#C8C4B8',transform:isCollapsed?'rotate(0deg)':'rotate(90deg)',transition:'transform 200ms'}}>
                            {Icons.chevron}
                          </span>
                        </button>
                        {!isCollapsed && [...open, ...done].map((t, i) => {
                          const status = t.status || (t.erledigt ? 'erledigt' : 'offen')
                          const s = TODO_STATUS[status] || TODO_STATUS.offen
                          const isDone = status === 'erledigt'
                          return (
                            <div key={i} className={`todo-card${isDone ? ' todo-card-done' : ''}`}>
                              <button className="todo-check-btn" onClick={() => cycleTodoStatus(t.docId, t.todoIdx)}
                                disabled={!canEdit} title={s.label}
                                style={{borderColor:s.color, background:s.bg, opacity:!canEdit?0.4:1}}>
                                {status === 'erledigt' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                                {status === 'in_bearbeitung' && <span style={{fontSize:10,color:'#8A5A12'}}>↻</span>}
                                {status === 'wartet' && <span style={{fontSize:10,color:'#1F3A52'}}>…</span>}
                              </button>
                              <div className="todo-body">
                                <div className="todo-aufgabe" style={{textDecoration:isDone?'line-through':'none',opacity:isDone?0.45:1}}>{t.aufgabe}</div>
                                <div className="todo-meta">
                                  <span>{t.catIco} {t.docName}</span>
                                  {t.frist && <span style={{color:dring==='ueberfaellig'?'#B3402C':dring==='hoch'?'#C2410C':'#8A5A12',fontWeight:600}}>
                                    {dring==='ueberfaellig'?'⚠ Überfällig · ':''}{new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}
                                  </span>}
                                  {status !== 'offen' && <span className="pill-status" style={{color:s.color,background:s.bg}}>{s.label}</span>}
                                  {t.erledigt_von && <span style={{color:'#9A968B'}}>{t.erledigt_von}</span>}
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

          {/* ── SUBVIEWS ── */}
          {session && view !== 'home' && (
            <div>

              {/* TODOS */}
              {view === 'todos' && (
                <div>
                  {mailDraft && (
                    <div className="mail-banner">
                      <div className="mail-banner-row">
                        {Icons.mail}
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'#1F3A52'}}>Antwort erforderlich</div>
                          <div className="caption">E-Mail-Vorlage erstellt</div>
                        </div>
                        <button onClick={() => setMailDraft(null)} className="icon-close">✕</button>
                      </div>
                      {mailDraft.betreff && <div className="mail-preview-row"><span>Betreff:</span> {mailDraft.betreff}</div>}
                      <button className="btn-primary btn-full" onClick={() => openMail(mailDraft)} style={{marginTop:10}}>In Mail öffnen</button>
                    </div>
                  )}

                  {allTodos.length === 0 ? (
                    <div className="empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4B8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
                      <p>Alle Aufgaben erledigt</p>
                      {isOwner && <button className="btn-ghost" onClick={() => setView('scan')}>Brief scannen</button>}
                    </div>
                  ) : (
                    <>
                      <div className="todos-bar">
                        <span className="todos-count">{openTodos} offen</span>
                        {urgentTodos > 0 && <span className="pill-signal">{urgentTodos} dringend</span>}
                        {!canEdit && <span className="pill-muted" style={{marginLeft:'auto'}}>Nur-Lesen</span>}
                      </div>
                      {DRING_ORDER.filter(d => d !== 'ignorieren').map(dring => {
                        const group = allTodos.filter(t => t.dringlichkeit === dring)
                        if (!group.length) return null
                        const d = DRING[dring]
                        const open = group.filter(t => !t.erledigt && t.status !== 'erledigt')
                        const done = group.filter(t =>  t.erledigt || t.status === 'erledigt')
                        return (
                          <div key={dring} className="todo-group">
                            <div className="todo-group-hd" style={{color: d.color}}>
                              <span className="todo-dot" style={{background: d.dot}}/>
                              {d.label}
                              <span style={{marginLeft:4,fontWeight:500,color:'#9A968B'}}>{open.length} offen</span>
                            </div>
                            {[...open, ...done].map((t, i) => {
                              const status = t.status || (t.erledigt ? 'erledigt' : 'offen')
                              const s = TODO_STATUS[status] || TODO_STATUS.offen
                              const isDone = status === 'erledigt'
                              return (
                                <div key={i} className={`todo-card${isDone ? ' todo-card-done' : ''}`}>
                                  <button className="todo-check-btn" onClick={() => cycleTodoStatus(t.docId, t.todoIdx)}
                                    disabled={!canEdit} title={s.label}
                                    style={{borderColor:s.color, background:s.bg, opacity:!canEdit?0.4:1}}>
                                    {status === 'erledigt' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                                    {status === 'in_bearbeitung' && <span style={{fontSize:10,color:'#8A5A12'}}>↻</span>}
                                    {status === 'wartet' && <span style={{fontSize:10,color:'#1F3A52'}}>…</span>}
                                  </button>
                                  <div className="todo-body">
                                    <div className="todo-aufgabe" style={{textDecoration:isDone?'line-through':'none',opacity:isDone?0.45:1}}>{t.aufgabe}</div>
                                    <div className="todo-meta">
                                      <span>{t.catIco} {t.docName}</span>
                                      {t.frist && <span style={{color:dring==='ueberfaellig'?'#B3402C':dring==='hoch'?'#C2410C':'#8A5A12',fontWeight:600}}>
                                        {dring==='ueberfaellig'?'⚠ Überfällig · ':''}{new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}
                                      </span>}
                                      {status !== 'offen' && <span className="pill-status" style={{color:s.color,background:s.bg}}>{s.label}</span>}
                                      {t.erledigt_von && <span style={{color:'#9A968B'}}>{t.erledigt_von}</span>}
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
              {view === 'scan' && isOwner && (
                <div>
                  <div className="overline" style={{marginBottom:10}}>Fotos / Seiten</div>
                  {duplikatWarnung && (
                    <div className="warn-box">
                      <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Mögliches Duplikat</div>
                      <div className="caption" style={{marginBottom:10}}>
                        Bereits gespeichert am {new Date(duplikatWarnung.erstellt_am).toLocaleDateString('de-DE')}: <strong>{duplikatWarnung.absender}</strong>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn-secondary" style={{flex:1,fontSize:13}} onClick={() => setDuplikatWarnung(null)}>Trotzdem speichern</button>
                        <button className="btn-primary" style={{flex:1,fontSize:13}} onClick={() => { setDuplikatWarnung(null); setPhotos([]) }}>Abbrechen</button>
                      </div>
                    </div>
                  )}

                  <div className="upload-zone" onClick={() => fileRef.current.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                    onDragLeave={e => e.currentTarget.classList.remove('over')}
                    onDrop={handleDrop}>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:'none'}}
                      onChange={e => { Array.from(e.target.files).forEach(f => addPhoto(f)); e.target.value = '' }} />
                    <div style={{width:56,height:56,borderRadius:16,background:'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',color:'#1F3A52'}}>
                      {Icons.camera}
                    </div>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>
                      {photos.length > 0 ? 'Weitere Seite hinzufügen' : 'Brief oder Foto aufnehmen'}
                    </div>
                    <div className="caption">Mehrere Seiten möglich — z.B. Vorder- und Rückseite</div>
                    <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:14}}>
                      <button className="btn-primary" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>Aufnehmen</button>
                      <button className="btn-secondary" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>Datei wählen</button>
                    </div>
                  </div>

                  {photos.length > 0 && (
                    <div className="photo-strip">
                      {photos.map((p, i) => (
                        <div key={i} className="photo-thumb">
                          {p.previewUrl
                            ? <img src={p.previewUrl} className="photo-img" alt={`Seite ${i+1}`} />
                            : <div className="photo-pdf">📄</div>}
                          <div className="caption" style={{marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{i+1}. {p.file.name.slice(0,12)}</div>
                          <button className="photo-remove" onClick={() => removePhoto(i)}>✕</button>
                        </div>
                      ))}
                      <button className="photo-add" onClick={() => fileRef.current.click()}>
                        <span style={{fontSize:22,fontWeight:300,lineHeight:1}}>+</span>
                        <span className="caption">Seite</span>
                      </button>
                    </div>
                  )}

                  {scanMsg && <div className={`msg ${scanMsg.err ? 'msg-err' : 'msg-ok'}`}>{scanMsg.text}</div>}
                  <button className="btn-primary btn-full" onClick={analyzeDoc} disabled={!photos.length || analyzing}
                    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    {Icons.sparkle}
                    {analyzing ? 'Wird analysiert…' : 'Brief analysieren'}
                  </button>
                  {analyzing && <div className="caption" style={{textAlign:'center',marginTop:8}}>Claude liest den Brief — 10–20 Sekunden</div>}
                </div>
              )}

              {/* ARCHIV */}
              {view === 'archiv' && (
                <div>
                  <div className="kpi-row">
                    <div className="kpi-cell"><div className="kpi-num">{docs.length}</div><div className="kpi-lbl">Dokumente</div></div>
                    <div className="kpi-cell"><div className="kpi-num">{docs.filter(d=>d.steuerrelevant).length}</div><div className="kpi-lbl">Steuer</div></div>
                    <div className="kpi-cell"><div className="kpi-num">{openTodos}</div><div className="kpi-lbl">Offen</div></div>
                  </div>
                  <div className="chip-bar">
                    {['Alle', ...Object.keys(CATS)].map(c => (
                      <button key={c} className={`chip${docFilter === c ? ' chip-active' : ''}`} onClick={() => setDocFilter(c)}>{c}</button>
                    ))}
                  </div>
                  {filteredDocs.length === 0
                    ? <div className="empty-state">
                        {Icons.archive}
                        <p>Keine Dokumente</p>
                      </div>
                    : filteredDocs.map(d => {
                        const cat = CATS[d.kategorie] || CATS['Sonstiges']
                        const dr = DRING[d.dringlichkeit] || DRING.niedrig
                        return (
                          <div key={d.id} className="doc-card" onClick={() => setSelectedDoc(d)}>
                            <div className="doc-card-row">
                              <div className="cat-chip" style={{background:cat.bg,color:cat.text}}>{cat.ico}</div>
                              <div className="doc-info">
                                <div className="doc-name">{d.absender || d.dateiname}</div>
                                <div className="doc-meta">{d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}{d.betrag!=null?' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):''}{d.quelle==='imap'?' · 📧':''}</div>
                              </div>
                              <span className="status-pill" style={{background:dr.bg,color:dr.color}}>{dr.label}</span>
                            </div>
                            {d.zusammenfassung && <p className="doc-summary">{d.zusammenfassung}</p>}
                            {d.anhaenge?.length > 0 && (
                              <div className="attach-row">
                                {d.anhaenge.map((a,i) => (
                                  <button key={i} className="attach-chip" onClick={e=>{e.stopPropagation();downloadDoc(a.storage_path,a.name)}}>📎 {a.name.slice(0,18)}</button>
                                ))}
                              </div>
                            )}
                            {isOwner && (
                              <div className="doc-actions" onClick={e => e.stopPropagation()}>
                                <button className="btn-ghost btn-sm" onClick={() => downloadDoc(d.storage_path, d.dateiname)}>Laden</button>
                                <button className="btn-ghost btn-sm" style={{color:'#1F3A52',borderColor:'#BBD0DE'}} onClick={() => { setSelectedDoc(null); genAnschreiben(d) }}>Anschreiben</button>
                                <button className="btn-ghost btn-sm btn-danger" onClick={() => deleteDoc(d.id, d.storage_path)}>Löschen</button>
                              </div>
                            )}
                          </div>
                        )
                      })
                  }
                </div>
              )}

              {/* FAMILIE */}
              {view === 'familie' && isOwner && (
                <div>
                  {familyMembers.length === 0 ? (
                    <div className="empty-state">
                      {Icons.users}
                      <p>Keine Familienmitglieder</p>
                      <p className="caption" style={{maxWidth:220,textAlign:'center',lineHeight:1.5}}>Füge Familienmitglieder über das Menü → Familie hinzu.</p>
                      <button className="btn-ghost" onClick={() => setMenuOpen(true)}>Familie einrichten</button>
                    </div>
                  ) : (
                    <>
                      <div className="todos-bar" style={{marginBottom:16}}>
                        <span className="todos-count">{familyMembers.filter(m=>m.aktiv).length} aktive Zugänge</span>
                        <button className="btn-ghost btn-sm" style={{marginLeft:'auto'}} onClick={() => setMenuOpen(true)}>Verwalten</button>
                      </div>
                      {familyMembers.map(m => (
                        <div key={m.id} className="card" style={{padding:16,marginBottom:10}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:42,height:42,borderRadius:'50%',background:m.aktiv?'#1F3A52':'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:m.aktiv?'#fff':'#1F3A52',fontSize:15,fontWeight:700,flexShrink:0}}>
                              {(m.mitglied_email||'?')[0].toUpperCase()}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:15,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.mitglied_email||'QR-Code-Einladung'}</div>
                              <span className={`pill-status ${m.aktiv?'pill-done':'pill-medium'}`} style={{marginTop:4,display:'inline-block'}}>
                                {m.aktiv?'✓ Aktiv':'⏳ Ausstehend'} · {PERM_OPTS.find(p=>p.value===m.berechtigung)?.label||m.berechtigung}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* EXPORT */}
              {view === 'export' && isOwner && (
                <div>
                  <div className="field-wrap">
                    <label className="field-label">Steuerjahr</label>
                    <select className="field-input" id="year-sel">
                      {(jahre.length ? jahre : [new Date().getFullYear()]).map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>

                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div style={{width:36,height:36,borderRadius:11,background:'#EAF0F4',display:'flex',alignItems:'center',justifyContent:'center',color:'#1F3A52',flexShrink:0}}>{Icons.download}</div>
                      <div className="card-title">PDF für Steuerberater</div>
                    </div>
                    <div className="caption" style={{marginBottom:12}}>Steuerrelevante Dokumente — druckfertig mit Zusammenfassung und Fristen.</div>
                    <button className="btn-primary" style={{display:'flex',alignItems:'center',gap:7}} onClick={exportPDF}>
                      {Icons.download} PDF herunterladen
                    </button>
                  </div>

                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div style={{width:36,height:36,borderRadius:11,background:'#E6F0E9',display:'flex',alignItems:'center',justifyContent:'center',color:'#2E5A3C',flexShrink:0}}>{Icons.upload}</div>
                      <div className="card-title">CSV für Excel / DATEV</div>
                    </div>
                    <div className="caption" style={{marginBottom:12}}>Tabellarische Übersicht aller Belege — direkt importierbar.</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn-primary" style={{flex:1}} onClick={() => exportCSV(true)}>Steuer-CSV</button>
                      <button className="btn-secondary" onClick={() => exportCSV(false)}>Alle</button>
                    </div>
                  </div>

                  {exportMsg && <div className={`msg ${exportMsg.err ? 'msg-err' : 'msg-ok'}`}>{exportMsg.text}</div>}

                  <div className="card" style={{padding:16}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                      <div style={{width:36,height:36,borderRadius:11,background:'#FBF0E8',display:'flex',alignItems:'center',justifyContent:'center',color:'#C2410C',flexShrink:0}}>{Icons.bell}</div>
                      <div className="card-title">E-Mail-Reminder</div>
                      <button className={`toggle-btn${reminderSettings?.aktiv ? ' toggle-on' : ''}`} style={{marginLeft:'auto'}}
                        onClick={() => saveReminder({aktiv:!reminderSettings?.aktiv})}>
                        <div className="toggle-knob" />
                      </button>
                    </div>
                    {reminderSettings?.aktiv && (
                      <>
                        <div className="field-wrap" style={{marginTop:14}}>
                          <label className="field-label">Häufigkeit</label>
                          {FREQ_OPTS.map(f => (
                            <label key={f.value} className={`perm-opt${reminderSettings?.frequenz === f.value ? ' perm-opt-active' : ''}`}
                              onClick={() => saveReminder({frequenz:f.value})}>
                              <div className={`perm-radio${reminderSettings?.frequenz === f.value ? ' perm-radio-on' : ''}`} />
                              <div className="perm-label">{f.label}</div>
                            </label>
                          ))}
                        </div>
                        <div className="field-wrap">
                          <label className="field-label">Uhrzeit</label>
                          <select className="field-input" value={reminderSettings?.uhrzeit_utc ?? 7}
                            onChange={e => saveReminder({uhrzeit_utc:parseInt(e.target.value)})}>
                            {[6,7,8,9,10,12,18,20].map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00 Uhr</option>)}
                          </select>
                        </div>
                        <div className="toggle-row">
                          <div>
                            <div style={{fontSize:15,fontWeight:600}}>Nur zeitkritische Todos</div>
                            <div className="caption" style={{marginTop:2}}>Dringendes + Frist ≤ 7 Tage</div>
                          </div>
                          <button className={`toggle-btn${reminderSettings?.nur_dringende ? ' toggle-on' : ''}`}
                            onClick={() => saveReminder({nur_dringende:!reminderSettings?.nur_dringende})}>
                            <div className="toggle-knob" />
                          </button>
                        </div>
                      </>
                    )}
                    {reminderMsg && <div className={`msg ${reminderMsg.err ? 'msg-err' : 'msg-ok'}`} style={{marginTop:10}}>{reminderMsg.text}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DOKUMENT DETAIL MODAL ── */}
        {selectedDoc && (
          <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-header" style={{background:'#1F3A52',borderRadius:'30px 30px 0 0',padding:'18px 20px 16px'}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:'#FBFAF8'}}>{selectedDoc.absender || selectedDoc.dateiname}</div>
                  <div style={{fontSize:12,color:'rgba(251,250,248,0.6)',marginTop:2}}>{selectedDoc.kategorie} · {new Date(selectedDoc.erstellt_am).toLocaleDateString('de-DE')}</div>
                </div>
                <button style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.14)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#FBFAF8',fontSize:16,flexShrink:0}}
                  onClick={() => setSelectedDoc(null)}>✕</button>
              </div>
              <div className="modal-body">
                {selectedDoc.zusammenfassung && (
                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div className="overline" style={{marginBottom:8}}>Zusammenfassung</div>
                    <p style={{fontSize:14,lineHeight:1.6,color:'#3A362E'}}>{selectedDoc.zusammenfassung}</p>
                  </div>
                )}
                {selectedDoc.todos?.length > 0 && (
                  <div className="card" style={{padding:16,marginBottom:10}}>
                    <div className="overline" style={{marginBottom:8}}>Aufgaben</div>
                    {selectedDoc.todos.map((t, i) => {
                      const status = t.status || (t.erledigt ? 'erledigt' : 'offen')
                      const s = TODO_STATUS[status] || TODO_STATUS.offen
                      return (
                        <div key={i} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid #EFEDE6'}}>
                          <button onClick={() => cycleTodoStatus(selectedDoc.id, i)}
                            style={{width:20,height:20,borderRadius:'50%',border:`1.5px solid ${s.color}`,flexShrink:0,marginTop:2,cursor:'pointer',background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                            {status==='erledigt' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2E7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                          </button>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:500,textDecoration:status==='erledigt'?'line-through':'none',opacity:status==='erledigt'?0.45:1}}>{t.aufgabe}</div>
                            <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap',alignItems:'center'}}>
                              <span className="pill-status" style={{color:s.color,background:s.bg}}>{s.label}</span>
                              {t.frist && <span style={{fontSize:12,color:'#8A5A12'}}>📅 {new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}</span>}
                              {t.erledigt_von && <span style={{fontSize:12,color:'#9A968B'}}>{t.erledigt_von}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="card" style={{padding:16,marginBottom:10}}>
                  <div className="overline" style={{marginBottom:8}}>Erinnerung setzen</div>
                  <div style={{display:'flex',gap:8}}>
                    <input type="date" value={docReminder} onChange={e => setDocReminder(e.target.value)}
                      min={new Date().toISOString().split('T')[0]} className="field-input" style={{flex:1}} />
                    <button className="btn-primary" onClick={() => saveDocReminder(selectedDoc.id, docReminder)} disabled={!docReminder}>Setzen</button>
                  </div>
                </div>
                <div className="card" style={{padding:16,marginBottom:14}}>
                  <div className="overline" style={{marginBottom:8}}>Notizen</div>
                  {!(selectedDoc.notizen?.length) && <div className="caption" style={{marginBottom:10}}>Noch keine Notizen.</div>}
                  {(selectedDoc.notizen||[]).map((n, i) => (
                    <div key={i} style={{padding:'8px 0',borderBottom:'1px solid #EFEDE6'}}>
                      <div style={{fontSize:14,fontWeight:500}}>{n.text}</div>
                      <div className="caption">{n.autor} · {new Date(n.erstellt_am).toLocaleDateString('de-DE')}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <input type="text" value={neueNotiz} onChange={e => setNeueNotiz(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addNotiz()}
                      placeholder="Notiz hinzufügen…" className="field-input" style={{flex:1}} />
                    <button className="btn-primary" onClick={addNotiz} disabled={!neueNotiz.trim() || notizSaving}>{notizSaving ? '…' : 'OK'}</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn-secondary" style={{flex:1}} onClick={() => downloadDoc(selectedDoc.storage_path, selectedDoc.dateiname)}>Laden</button>
                  <button className="btn-secondary" style={{flex:1,color:'#1F3A52',borderColor:'#BBD0DE'}}
                    onClick={() => { setSelectedDoc(null); genAnschreiben(selectedDoc) }}>Anschreiben</button>
                  <button style={{padding:'11px 14px',borderRadius:14,border:'1px solid #F1CFC7',background:'#FBEFEC',color:'#B3402C',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',fontWeight:600,fontSize:14}}
                    onClick={() => { setSelectedDoc(null); deleteDoc(selectedDoc.id, selectedDoc.storage_path) }}>
                    {Icons.trash}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANSCHREIBEN MODAL ── */}
        {anschreiben && (
          <div className="modal-overlay" onClick={() => setAnschreiben(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-header">
                <span style={{fontSize:18,fontWeight:700}}>Anschreiben</span>
                <button className="icon-close" onClick={() => setAnschreiben(null)}>✕</button>
              </div>
              <div className="modal-body">
                {anschreiben.loading && <div className="caption" style={{textAlign:'center',padding:'2rem'}}>Wird generiert…</div>}
                {anschreiben.error && <div className="msg msg-err">{anschreiben.error}</div>}
                {anschreiben.betreff && (
                  <>
                    <div className="overline" style={{marginBottom:4}}>Betreff</div>
                    <div className="card" style={{padding:'10px 16px',marginBottom:12,fontWeight:600}}>{anschreiben.betreff}</div>
                    <div className="overline" style={{marginBottom:4}}>Anschreiben</div>
                    <div className="card" style={{padding:16,marginBottom:14,fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap',maxHeight:280,overflowY:'auto'}}>{anschreiben.anschreiben}</div>
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

        {/* ── HAMBURGER MENU ── */}
        {menuOpen && (
          <div className="modal-overlay" onClick={() => setMenuOpen(false)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 10px'}}>
                <span style={{fontSize:18,fontWeight:700,color:'var(--ps-ink)'}}>Menü</span>
                <button className="icon-close" onClick={() => setMenuOpen(false)}>✕</button>
              </div>
              <div style={{padding:'0 0 max(32px,env(safe-area-inset-bottom))'}}>
                {[
                  { id:'archiv',       label:'Archiv',           desc:`${docs.length} Dokumente`,                               icon: Icons.archive, icoBg:'#E6F0E9', icoColor:'#2E5A3C' },
                  ...(isOwner ? [
                    { id:'familie',       label:'Familie',          desc:`${familyMembers.filter(m=>m.aktiv).length} aktive Zugänge`, icon: Icons.users,   icoBg:'#FBF0E8', icoColor:'#C2410C' },
                    { id:'kontakte',     label:'Kontakte',         desc:'Arzt, Anwalt & Co.',                                    icon: Icons.contact, icoBg:'#EAF0F4', icoColor:'#1F3A52', href:'/profil' },
                    { id:'export',       label:'Export',           desc:'PDF & CSV',                                             icon: Icons.upload,  icoBg:'#FBF0DC', icoColor:'#8A5A12' },
                    { id:'profil',       label:'Profil',           desc:'Persönliche Daten',                                     icon: Icons.user,    icoBg:'#F4F2EC', icoColor:'#7C786E', href:'/profil' },
                  ] : [])
                ].map(item => (
                  <button key={item.id} className="menu-item"
                    onClick={() => { setMenuOpen(false); item.href ? (window.location.href = item.href) : setView(item.id) }}>
                    <div className="menu-item-ico" style={{background:item.icoBg,color:item.icoColor}}>{item.icon}</div>
                    <div className="menu-item-info">
                      <span className="menu-item-label">{item.label}</span>
                      <span className="menu-item-desc">{item.desc}</span>
                    </div>
                    {Icons.chevron}
                  </button>
                ))}
                {isOwner && (
                  <div style={{margin:'8px 16px 0',padding:'12px 14px',background:'var(--ps-petrol-tint)',border:'1px solid var(--ps-petrol-tint-bd)',borderRadius:14}}>
                    <div className="overline" style={{marginBottom:5,color:'var(--ps-faint)'}}>Per E-Mail weiterleiten</div>
                    <div style={{fontSize:12,fontFamily:'monospace',color:'var(--ps-petrol)',fontWeight:600,wordBreak:'break-all'}}>briefe+{session.user.id.slice(0,8)}@postscout.app</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BOTTOM NAV ── */}
        {showBottomNav && (
          <nav className="bottom-nav">
            {NAV_TABS.filter(t => isOwner || t.id === 'home' || t.id === 'archiv').map(tab => {
              const isActive = view === tab.id
              return (
                <button key={tab.id} className={`bottom-tab${isActive ? ' bottom-tab-active' : ''}`}
                  onClick={() => setView(tab.id)}>
                  <span className="bottom-tab-ico">{tab.icon}</span>
                  <span className="bottom-tab-lbl">{tab.label}</span>
                  {tab.id === 'home' && openTodos > 0 && (
                    <span className="bottom-badge" style={{background: urgentTodos > 0 ? '#F97316' : '#1F3A52'}}>{openTodos}</span>
                  )}
                </button>
              )
            })}
          </nav>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');

        :root {
          --ps-petrol:#1F3A52; --ps-petrol-pressed:#16304A;
          --ps-petrol-tint:#EAF0F4; --ps-petrol-tint-bd:#BBD0DE;
          --ps-bg:#FBFAF8; --ps-surface:#FFFFFF; --ps-subtle:#F4F2EC;
          --ps-ink:#1A1712; --ps-muted:#7C786E; --ps-faint:#9A968B;
          --ps-border:#E0DDD3; --ps-hairline:#EFEDE6;
          --ps-signal:#F97316;
          --ps-overdue:#B3402C; --ps-overdue-bg:#FBEAE7;
          --ps-urgent:#C2410C; --ps-urgent-bg:#FBF0E8;
          --ps-medium:#8A5A12; --ps-medium-bg:#FBF4E6;
          --ps-done:#2E7D46; --ps-done-bg:#E9F0E9;
          --ps-inprogress:#1F3A52; --ps-inprogress-bg:#EAF0F4;
          --ps-font:"Figtree",system-ui,-apple-system,sans-serif;
        }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:var(--ps-font); background:#EDEBE4; color:var(--ps-ink); -webkit-font-smoothing:antialiased; min-height:100vh; }
        input,button,select,textarea { font-family:inherit; }

        .shell { max-width:430px; margin:0 auto; min-height:100vh; background:var(--ps-bg); position:relative; box-shadow:0 0 80px rgba(26,23,18,0.15); }
        .content { padding:0 16px 112px; }

        /* Typography */
        .overline { font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#B6B2A6; }
        .caption { font-size:13px; font-weight:500; color:var(--ps-muted); line-height:1.4; }

        /* Header */
        .top-bar { background:var(--ps-petrol); padding:14px 18px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:50; box-shadow:0 1px 0 rgba(255,255,255,0.06),0 2px 12px rgba(26,23,18,0.18); }
        .top-logo { display:flex; align-items:center; gap:9px; background:none; border:none; cursor:pointer; padding:0; color:white; }
        .top-logo-text { font-size:16px; font-weight:700; color:#fff; letter-spacing:-0.2px; }
        .top-back-btn { width:36px; height:36px; border-radius:11px; border:none; background:rgba(255,255,255,0.13); display:flex; align-items:center; justify-content:center; cursor:pointer; color:#FBFAF8; transition:background 120ms; }
        .top-back-btn:hover { background:rgba(255,255,255,0.2); }
        .top-badge { background:var(--ps-signal); color:#fff; border-radius:20px; font-size:11px; font-weight:700; padding:3px 10px; cursor:pointer; }
        .top-user-btn { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.13); border:none; border-radius:20px; padding:6px 13px; cursor:pointer; color:rgba(255,255,255,0.88); font-size:12px; font-weight:600; transition:background 120ms; }
        .top-user-btn:hover { background:rgba(255,255,255,0.2); }

        /* Auth */
        .auth-hero { background:var(--ps-petrol); padding:64px 28px 48px; text-align:center; }
        .auth-title { font-size:32px; font-weight:700; color:#fff; margin-bottom:10px; letter-spacing:-0.025em; }
        .auth-sub { font-size:16px; color:rgba(255,255,255,0.62); line-height:1.5; }
        .auth-sheet { background:var(--ps-surface); border-radius:16px; padding:20px; margin:20px 0; border:1px solid var(--ps-hairline); }
        .auth-toggle { font-size:13px; color:var(--ps-faint); margin-top:14px; text-align:center; }
        .auth-toggle a { color:var(--ps-petrol); font-weight:600; cursor:pointer; }

        /* Dashboard */
        .dash-hero { background:var(--ps-petrol); padding:36px 24px 28px; border-radius:0 0 28px 28px; margin-bottom:20px; }
        .dash-hero-label { font-size:13px; font-weight:500; color:rgba(255,255,255,0.52); margin-bottom:12px; letter-spacing:0.01em; }
        .dash-hero-num { font-size:54px; font-weight:800; color:#fff; line-height:0.88; letter-spacing:-0.04em; }
        .dash-hero-sub { font-size:16px; font-weight:500; color:rgba(255,255,255,0.82); line-height:1.2; padding-bottom:4px; }
        .dash-stats { display:flex; align-items:center; margin-top:28px; border-top:1px solid rgba(255,255,255,0.13); padding-top:20px; }
        .dash-stat { flex:1; display:flex; flex-direction:column; gap:4px; }
        .dash-stat-num { font-size:21px; font-weight:800; color:#fff; line-height:1; }
        .dash-stat-lbl { font-size:10px; font-weight:600; color:rgba(255,255,255,0.45); letter-spacing:0.07em; text-transform:uppercase; }
        .dash-stat-div { width:1px; height:32px; background:rgba(255,255,255,0.14); margin:0 4px; flex-shrink:0; }

        /* Scan CTA */
        .scan-cta { width:100%; display:flex; align-items:center; gap:10px; padding:0 18px; height:58px; background:var(--ps-petrol); color:#FBFAF8; border:none; border-radius:18px; cursor:pointer; font-size:16px; font-weight:600; margin-bottom:20px; transition:background 120ms,box-shadow 120ms,transform 80ms; box-shadow:0 2px 10px rgba(31,58,82,0.28); }
        .scan-cta:hover { background:var(--ps-petrol-pressed); box-shadow:0 4px 16px rgba(31,58,82,0.36); transform:translateY(-1px); }
        .scan-cta:active { transform:scale(0.98); box-shadow:0 1px 4px rgba(31,58,82,0.2); }
        .scan-cta svg:last-child { margin-left:auto; opacity:0.65; }

        /* Menu */
        .menu-list { background:var(--ps-surface); border-radius:20px; border:1px solid var(--ps-hairline); overflow:hidden; margin-bottom:16px; box-shadow:0 1px 4px rgba(26,23,18,0.05); }
        .menu-item { width:100%; display:flex; align-items:center; gap:14px; padding:16px 18px; background:transparent; border:none; border-bottom:1px solid var(--ps-hairline); cursor:pointer; transition:background 100ms; }
        .menu-item:last-child { border-bottom:none; }
        .menu-item:active { background:var(--ps-subtle); }
        .menu-item-ico { width:42px; height:42px; border-radius:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .menu-item-info { flex:1; text-align:left; min-width:0; }
        .menu-item-label { display:block; font-size:16px; font-weight:600; color:var(--ps-ink); }
        .menu-item-desc { display:block; font-size:13px; color:var(--ps-faint); margin-top:2px; }
        .menu-badge { border-radius:12px; font-size:12px; font-weight:700; padding:3px 9px; color:#fff; flex-shrink:0; }

        /* Inbound */
        .inbound-card { background:var(--ps-surface); border:1px solid var(--ps-hairline); border-radius:16px; padding:16px 18px; margin-top:0; }
        .inbound-addr { font-size:12px; font-family:monospace; background:var(--ps-petrol-tint); border-radius:8px; padding:9px 12px; color:var(--ps-petrol); font-weight:600; word-break:break-all; border:1px solid var(--ps-petrol-tint-bd); }

        /* Buttons */
        .btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 18px; border-radius:14px; border:none; background:var(--ps-petrol); color:#fff; font-size:15px; font-weight:600; cursor:pointer; transition:background 120ms,transform 80ms; }
        .btn-primary:hover { background:var(--ps-petrol-pressed); }
        .btn-primary:active { transform:scale(0.97); }
        .btn-primary:disabled { opacity:0.45; cursor:not-allowed; transform:none; }
        .btn-full { width:100%; padding:15px; border-radius:15px; font-size:16px; }
        .btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 18px; border-radius:14px; border:1.5px solid var(--ps-border); background:var(--ps-surface); color:var(--ps-ink); font-size:15px; font-weight:600; cursor:pointer; transition:background 120ms; }
        .btn-secondary:hover { background:var(--ps-subtle); }
        .btn-ghost { display:inline-flex; align-items:center; gap:5px; padding:7px 12px; border-radius:11px; border:1px solid var(--ps-border); background:transparent; color:var(--ps-muted); font-size:13px; font-weight:500; cursor:pointer; transition:background 100ms; }
        .btn-ghost:hover { background:var(--ps-subtle); }
        .btn-sm { padding:6px 10px; font-size:12px; }
        .btn-danger:hover { background:var(--ps-overdue-bg); color:var(--ps-overdue); border-color:#f5c0b6; }

        /* Fields */
        .field-wrap { margin-bottom:12px; }
        .field-label { font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ps-faint); display:block; margin-bottom:6px; }
        .field-input { width:100%; padding:11px 13px; border-radius:11px; border:1.5px solid var(--ps-border); background:var(--ps-subtle); color:var(--ps-ink); font-size:15px; font-weight:500; transition:border-color 150ms,background 150ms; }
        .field-input:focus { outline:none; border-color:var(--ps-petrol); background:var(--ps-surface); }

        /* Upload */
        .upload-zone { border:1.5px dashed #C8C4B8; border-radius:18px; padding:34px 20px; text-align:center; cursor:pointer; transition:border-color 150ms,background 150ms; margin-bottom:14px; background:var(--ps-surface); }
        .upload-zone:hover, .upload-zone.over { border-color:var(--ps-petrol); background:var(--ps-petrol-tint); }

        /* Photo strip */
        .photo-strip { display:flex; gap:10px; overflow-x:auto; padding:4px 0 10px; margin-bottom:10px; scrollbar-width:none; }
        .photo-strip::-webkit-scrollbar { display:none; }
        .photo-thumb { position:relative; flex-shrink:0; width:74px; }
        .photo-img { width:74px; height:74px; object-fit:cover; border-radius:12px; border:1px solid var(--ps-hairline); }
        .photo-pdf { width:74px; height:74px; border-radius:12px; border:1px solid var(--ps-hairline); background:var(--ps-subtle); display:flex; align-items:center; justify-content:center; font-size:26px; }
        .photo-remove { position:absolute; top:-5px; right:-5px; width:18px; height:18px; border-radius:50%; background:var(--ps-overdue); color:#fff; border:none; cursor:pointer; font-size:9px; display:flex; align-items:center; justify-content:center; }
        .photo-add { flex-shrink:0; width:74px; height:74px; border-radius:12px; border:1.5px dashed #C8C4B8; background:transparent; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--ps-faint); gap:2px; transition:background 100ms; font-family:inherit; }
        .photo-add:hover { background:var(--ps-subtle); }

        /* Todos */
        .todos-bar { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding:12px 16px; background:var(--ps-surface); border-radius:16px; border:1px solid var(--ps-hairline); box-shadow:0 1px 3px rgba(26,23,18,0.04); }
        .todos-count { font-size:16px; font-weight:700; color:var(--ps-ink); }
        .todo-group { margin-bottom:20px; }
        .todo-group-hd { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; margin-bottom:10px; letter-spacing:0.07em; text-transform:uppercase; }
        .todo-group-toggle { width:100%; display:flex; align-items:center; justify-content:space-between; background:none; border:none; cursor:pointer; padding:4px 0 10px; font-family:inherit; }
        .todo-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .todo-card { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; background:var(--ps-surface); border-radius:16px; border:1px solid var(--ps-hairline); margin-bottom:8px; transition:opacity 180ms; box-shadow:0 1px 3px rgba(26,23,18,0.04); }
        .todo-card-done { opacity:0.5; }
        .todo-check-btn { width:22px; height:22px; border-radius:50%; border:2px solid; flex-shrink:0; margin-top:2px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 120ms,border-color 120ms; font-family:inherit; }
        .todo-body { flex:1; min-width:0; }
        .todo-aufgabe { font-size:14px; font-weight:500; color:var(--ps-ink); line-height:1.45; margin-bottom:6px; }
        .todo-meta { display:flex; gap:8px; flex-wrap:wrap; align-items:center; font-size:11px; color:var(--ps-faint); }

        /* Pills */
        .pill-signal { background:var(--ps-urgent-bg); color:var(--ps-urgent); border-radius:20px; font-size:12px; font-weight:600; padding:2px 10px; }
        .pill-muted { background:var(--ps-subtle); color:var(--ps-muted); border-radius:20px; font-size:12px; font-weight:600; padding:2px 10px; }
        .pill-status { font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; }
        .pill-done { background:var(--ps-done-bg); color:var(--ps-done); }
        .pill-medium { background:var(--ps-medium-bg); color:var(--ps-medium); }

        /* KPI */
        .kpi-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .kpi-cell { background:var(--ps-surface); border-radius:12px; padding:12px; border:1px solid var(--ps-hairline); }
        .kpi-num { font-size:22px; font-weight:800; color:var(--ps-ink); }
        .kpi-lbl { font-size:11px; color:var(--ps-faint); margin-top:2px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }

        /* Chips */
        .chip-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; overflow-x:auto; scrollbar-width:none; }
        .chip-bar::-webkit-scrollbar { display:none; }
        .chip { padding:5px 12px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid var(--ps-border); background:var(--ps-surface); color:var(--ps-muted); white-space:nowrap; font-family:inherit; }
        .chip-active { background:var(--ps-petrol); color:#fff; border-color:var(--ps-petrol); }

        /* Doc cards */
        .doc-card { background:var(--ps-surface); border-radius:16px; border:1px solid var(--ps-hairline); padding:13px 14px; margin-bottom:10px; cursor:pointer; transition:background 100ms; }
        .doc-card:hover { background:var(--ps-subtle); }
        .doc-card-row { display:flex; align-items:flex-start; gap:10px; margin-bottom:6px; }
        .cat-chip { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
        .doc-info { flex:1; min-width:0; }
        .doc-name { font-size:15px; font-weight:600; color:var(--ps-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .doc-meta { font-size:12px; color:var(--ps-faint); margin-top:2px; }
        .doc-summary { font-size:13px; color:var(--ps-muted); line-height:1.6; margin-bottom:10px; }
        .status-pill { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; flex-shrink:0; white-space:nowrap; }
        .doc-actions { display:flex; gap:6px; margin-top:10px; }
        .attach-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .attach-chip { padding:4px 10px; border-radius:20px; font-size:11px; border:1px solid var(--ps-border); background:var(--ps-subtle); color:var(--ps-muted); cursor:pointer; font-family:inherit; }

        /* Perm */
        .perm-opt { display:flex; align-items:flex-start; gap:10px; padding:10px; border-radius:11px; border:1.5px solid var(--ps-border); margin-bottom:7px; cursor:pointer; transition:border-color 120ms,background 120ms; }
        .perm-opt-active { border-color:var(--ps-petrol); background:#F7FAFB; }
        .perm-radio { width:17px; height:17px; border-radius:50%; border:2px solid var(--ps-border); flex-shrink:0; margin-top:2px; transition:all 120ms; }
        .perm-radio-on { border-color:var(--ps-petrol); background:var(--ps-petrol); }
        .perm-label { font-size:14px; font-weight:600; color:var(--ps-ink); }

        /* Card */
        .card { background:var(--ps-surface); border-radius:16px; border:1px solid var(--ps-hairline); }
        .card-title { font-size:15px; font-weight:700; color:var(--ps-ink); }

        /* Member row */
        .member-row { display:flex; align-items:center; gap:8px; padding:10px 0; border-bottom:1px solid var(--ps-hairline); }
        .member-row:last-child { border-bottom:none; }
        .select-sm { font-size:12px; padding:4px 8px; border-radius:11px; border:1px solid var(--ps-border); background:var(--ps-surface); color:var(--ps-ink); cursor:pointer; }

        /* Toggle */
        .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-top:1px solid var(--ps-hairline); margin-top:6px; gap:12px; }
        .toggle-btn { width:44px; height:26px; border-radius:20px; border:none; background:var(--ps-border); cursor:pointer; position:relative; transition:background 180ms; padding:0; flex-shrink:0; }
        .toggle-on { background:var(--ps-petrol); }
        .toggle-knob { width:20px; height:20px; border-radius:50%; background:#fff; position:absolute; top:3px; left:3px; transition:transform 180ms; box-shadow:0 1px 3px rgba(0,0,0,0.18); }
        .toggle-on .toggle-knob { transform:translateX(18px); }

        /* Msgs */
        .msg { border-radius:11px; padding:10px 13px; font-size:13px; margin-bottom:10px; font-weight:500; }
        .msg-err { background:var(--ps-overdue-bg); color:var(--ps-overdue); border:1px solid #f5c0b6; }
        .msg-ok { background:var(--ps-done-bg); color:var(--ps-done); border:1px solid #b8d9c0; }
        .warn-box { background:var(--ps-medium-bg); border:1px solid #e8c87a; border-radius:16px; padding:16px; margin-bottom:12px; }

        /* Empty */
        .empty-state { text-align:center; padding:3rem 1rem; color:var(--ps-faint); display:flex; flex-direction:column; align-items:center; gap:10px; }
        .empty-state p { font-size:14px; font-weight:500; }

        /* Mail banner */
        .mail-banner { background:var(--ps-petrol-tint); border:1px solid var(--ps-petrol-tint-bd); border-radius:16px; padding:16px; margin-bottom:12px; }
        .mail-banner-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .mail-preview-row { font-size:12px; color:var(--ps-muted); background:var(--ps-surface); border-radius:8px; padding:8px 10px; margin-bottom:4px; }
        .mail-preview-row span { font-weight:700; color:var(--ps-ink); }

        /* Modal */
        .modal-overlay { position:fixed; inset:0; background:rgba(26,23,18,0.55); z-index:200; display:flex; align-items:flex-end; }
        .modal-sheet { background:var(--ps-bg); border-radius:30px 30px 0 0; width:100%; max-width:430px; margin:0 auto; max-height:90vh; overflow-y:auto; }
        .modal-handle { width:40px; height:4px; border-radius:2px; background:var(--ps-border); margin:12px auto 0; }
        .modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px 12px; border-bottom:1px solid var(--ps-hairline); }
        .modal-body { padding:16px 20px 32px; }
        .icon-close { background:var(--ps-subtle); border:none; cursor:pointer; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--ps-muted); flex-shrink:0; }

        /* Bottom Nav */
        .bottom-nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:rgba(251,250,248,0.97); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid var(--ps-hairline); display:flex; z-index:100; padding:8px 4px max(20px,env(safe-area-inset-bottom)); box-shadow:0 -1px 0 var(--ps-hairline); }
        .bottom-tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:2px 4px; border:none; background:transparent; cursor:pointer; position:relative; font-family:inherit; color:#B0ADA4; transition:color 150ms; }
        .bottom-tab-active { color:var(--ps-petrol); }
        .bottom-tab-ico { display:flex; align-items:center; justify-content:center; width:48px; height:30px; border-radius:15px; transition:background 150ms; }
        .bottom-tab-active .bottom-tab-ico { background:var(--ps-petrol-tint); }
        .bottom-tab-lbl { font-size:10px; font-weight:500; letter-spacing:0.01em; }
        .bottom-tab-active .bottom-tab-lbl { font-weight:700; color:var(--ps-petrol); }
        .bottom-badge { position:absolute; top:2px; right:calc(50% - 28px); background:var(--ps-signal); color:#fff; border-radius:20px; font-size:9px; font-weight:700; padding:1px 5px; min-width:16px; text-align:center; border:1.5px solid var(--ps-bg); }

        @media(prefers-reduced-motion:reduce) {
          *, *::before, *::after { transition:none !important; }
        }
      `}</style>
    </>
  )
}
