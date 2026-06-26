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
const DRING_ORDER = ['hoch', 'mittel', 'niedrig']
const DRING = {
  hoch:    { label: 'Dringend',      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  mittel:  { label: 'Mittelfristig', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  niedrig: { label: 'Kein Zeitdruck',color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
}

export default function Home() {
  const [session, setSession]       = useState(null)
  const [authMode, setAuthMode]     = useState('login')
  const [authEmail, setAuthEmail]   = useState('')
  const [authPw, setAuthPw]         = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg]       = useState(null)

  const [tab, setTab]               = useState('todos')
  const [photos, setPhotos]         = useState([])   // [{file, base64, previewUrl}]
  const [analyzing, setAnalyzing]   = useState(false)
  const [scanMsg, setScanMsg]       = useState(null)
  const [docs, setDocs]             = useState([])
  const [allTodos, setAllTodos]     = useState([])   // flat list across docs
  const [filter, setFilter]         = useState('Alle')
  const [exportMsg, setExportMsg]   = useState(null)
  const [mailDraft, setMailDraft]   = useState(null) // {to, subject, body}
  const fileRef = useRef()

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadAll()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (session) loadAll()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleAuth() {
    setAuthLoading(true); setAuthMsg(null)
    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPw })
      : await supabase.auth.signUp({ email: authEmail, password: authPw })
    if (error) setAuthMsg({ text: error.message, err: true })
    else if (authMode === 'register') setAuthMsg({ text: 'Bestätigungs-E-Mail gesendet.', err: false })
    setAuthLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setDocs([]); setAllTodos([]); setPhotos([])
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('dokumente').select('*').order('erstellt_am', { ascending: false })
    if (!error) {
      setDocs(data || [])
      buildTodoList(data || [])
    }
  }, [])

  function buildTodoList(docs) {
    const flat = []
    docs.forEach(doc => {
      const cat = CATS[doc.kategorie] || CATS['Sonstiges']
      ;(doc.todos || []).forEach((t, idx) => {
        flat.push({
          ...t,
          docId: doc.id,
          docName: doc.absender || doc.dateiname,
          docKat: doc.kategorie,
          catIco: cat.ico,
          todoIdx: idx,
          dringlichkeit: t.dringlichkeit || doc.dringlichkeit || 'niedrig',
        })
      })
    })
    // Sort: erledigt last, then by dringlichkeit, then by frist
    flat.sort((a, b) => {
      if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1
      const da = DRING_ORDER.indexOf(a.dringlichkeit)
      const db = DRING_ORDER.indexOf(b.dringlichkeit)
      if (da !== db) return da - db
      if (a.frist && b.frist) return new Date(a.frist) - new Date(b.frist)
      if (a.frist) return -1
      if (b.frist) return 1
      return 0
    })
    setAllTodos(flat)
  }

  // ── Photo handling ────────────────────────────────────────────────────────
  function addPhoto(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target.result
      setPhotos(prev => [...prev, {
        file,
        base64: url.split(',')[1],
        previewUrl: file.type.startsWith('image/') ? url : null,
        mimeType: file.type,
      }])
    }
    reader.readAsDataURL(file)
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function handleDrop(e) {
    e.preventDefault()
    e.currentTarget.classList.remove('over')
    Array.from(e.dataTransfer.files).forEach(f => addPhoto(f))
  }

  // ── Analyse ───────────────────────────────────────────────────────────────
  async function analyzeDoc() {
    if (!photos.length) return
    setAnalyzing(true); setScanMsg(null)

    try {
      // Build content with all photos/pages
      const contentParts = []
      for (const p of photos) {
        if (p.mimeType.startsWith('image/')) {
          contentParts.push({ type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.base64 } })
        } else {
          contentParts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } })
        }
      }
      contentParts.push({ type: 'text', text: photos.length > 1
        ? `Analysiere diese ${photos.length} Seiten/Bilder als zusammengehöriges Dokument.`
        : 'Analysiere diesen Brief.' })

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentParts }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Analyse fehlgeschlagen') }
      const r = await res.json()

      // Upload all photos to storage
      const uid = session.user.id
      const ts = Date.now()
      const storagePaths = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        const path = `${uid}/${ts}_${i}_${p.file.name}`
        const { error: se } = await supabase.storage.from('dokumente').upload(path, p.file, { contentType: p.mimeType })
        if (se) throw new Error('Upload fehlgeschlagen: ' + se.message)
        storagePaths.push(path)
      }

      const { error: dbErr } = await supabase.from('dokumente').insert({
        user_id: uid,
        dateiname: photos.map(p => p.file.name).join(', '),
        storage_path: storagePaths[0],
        mime_type: photos[0].mimeType,
        kategorie: r.kategorie,
        absender: r.absender,
        zusammenfassung: r.zusammenfassung,
        dringlichkeit: r.dringlichkeit,
        frist: parseFrist(r.frist),
        betrag: r.betrag,
        steuerrelevant: r.steuerrelevant,
        jahr: new Date().getFullYear(),
        todos: (r.todos || []).map(t => ({ ...t, dringlichkeit: r.dringlichkeit })),
        empfehlungen: r.empfehlungen || [],
      })
      if (dbErr) throw new Error('DB-Fehler: ' + dbErr.message)

      // Check if mail reply needed
      if (r.mailAntwortErforderlich && r.mailVorlage) {
        setMailDraft(r.mailVorlage)
      }

      setPhotos([])
      await loadAll()
      setTab('todos') // → back to todo overview

    } catch (e) {
      setScanMsg({ text: e.message, err: true })
    } finally {
      setAnalyzing(false)
    }
  }

  function parseFrist(frist) {
    if (!frist) return null
    const parts = frist.split('.')
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
    return null
  }

  // ── Todo toggle ───────────────────────────────────────────────────────────
  async function toggleTodo(docId, todoIdx) {
    const doc = docs.find(d => d.id === docId)
    if (!doc) return
    const newTodos = doc.todos.map((t, i) =>
      i === todoIdx ? { ...t, erledigt: !t.erledigt } : t
    )
    await supabase.from('dokumente').update({ todos: newTodos }).eq('id', docId)
    await loadAll()
  }

  // ── Mail draft ────────────────────────────────────────────────────────────
  function openMail(draft) {
    const mailto = `mailto:${draft.an || ''}?subject=${encodeURIComponent(draft.betreff || '')}&body=${encodeURIComponent(draft.text || '')}`
    window.open(mailto, '_blank')
  }

  // ── Archive ───────────────────────────────────────────────────────────────
  async function downloadDoc(path, name) {
    const { data, error } = await supabase.storage.from('dokumente').download(path)
    if (error) { alert('Download fehlgeschlagen: ' + error.message); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteDoc(id, path) {
    if (!confirm('Dokument wirklich löschen?')) return
    await supabase.storage.from('dokumente').remove([path])
    await supabase.from('dokumente').delete().eq('id', id)
    await loadAll()
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function getYear() {
    const sel = document.getElementById('year-sel')
    return sel ? parseInt(sel.value) : new Date().getFullYear()
  }

  function exportCSV(nurSteuer = true) {
    const jahr = getYear()
    const filtered = docs.filter(d =>
      (d.jahr || new Date().getFullYear()) === jahr &&
      (!nurSteuer || d.steuerrelevant || d.kategorie === 'Steuer / Finanzamt')
    )
    if (!filtered.length) { setExportMsg({ text: 'Keine Dokumente für ' + jahr, err: true }); return }
    const header = ['Datum','Absender','Kategorie','Steuerrelevant','Betrag (EUR)','Zusammenfassung','Frist','Datei']
    const rows = filtered.map(d => [
      new Date(d.erstellt_am).toLocaleDateString('de-DE'),
      d.absender||'', d.kategorie, d.steuerrelevant?'Ja':'Nein',
      d.betrag!=null?Number(d.betrag).toFixed(2):'',
      '"'+(d.zusammenfassung||'').replace(/"/g,"''")+'"',
      d.frist?new Date(d.frist).toLocaleDateString('de-DE'):'',
      d.dateiname||'',
    ])
    const csv = [header,...rows].map(r=>r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download=`postscout_${nurSteuer?'steuer':'alle'}_${jahr}.csv`; a.click()
    setExportMsg({ text: `✓ CSV mit ${filtered.length} Dokument(en).`, err: false })
    setTimeout(()=>setExportMsg(null), 4000)
  }

  function exportPDF() {
    const jahr = getYear()
    const filtered = docs.filter(d =>
      (d.jahr||new Date().getFullYear())===jahr &&
      (d.steuerrelevant||d.kategorie==='Steuer / Finanzamt')
    )
    if (!filtered.length) { setExportMsg({ text: 'Keine steuerrelevanten Dokumente für '+jahr, err: true }); return }
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
    const W=210,pad=18; let y=pad
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(26,25,22)
    doc.text('PostScout – Steuerübersicht '+jahr, pad, y); y+=8
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(120,120,120)
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')} · ${filtered.length} Dokument(e)`, pad, y); y+=9
    doc.setDrawColor(228,226,217); doc.setLineWidth(0.3); doc.line(pad,y,W-pad,y); y+=7
    const gesamt = filtered.reduce((s,d)=>s+(Number(d.betrag)||0),0)
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,25,22)
    doc.text('Gesamtbetrag:', pad, y)
    doc.text(gesamt.toLocaleString('de-DE',{style:'currency',currency:'EUR'}), W-pad, y, {align:'right'})
    y+=9; doc.line(pad,y,W-pad,y); y+=7
    filtered.forEach((d,i)=>{
      if(y>260){doc.addPage();y=pad}
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,25,22)
      doc.text((i+1)+'. '+(d.absender||d.dateiname||'Unbekannt'), pad, y); y+=5
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,90,90)
      const datum=new Date(d.erstellt_am).toLocaleDateString('de-DE')
      const betragStr=d.betrag!=null?' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'}):''
      doc.text(d.kategorie+' · '+datum+betragStr, pad+3, y); y+=5
      if(d.zusammenfassung){
        const lines=doc.splitTextToSize(d.zusammenfassung,W-pad*2-3)
        doc.setTextColor(50,50,50); doc.text(lines,pad+3,y); y+=lines.length*4.5
      }
      if(d.frist){doc.setTextColor(180,100,0); doc.text('Frist: '+new Date(d.frist).toLocaleDateString('de-DE'),pad+3,y); y+=5}
      y+=4; doc.setDrawColor(235,235,235); doc.line(pad,y,W-pad,y); y+=6
    })
    doc.save('postscout_steuer_'+jahr+'.pdf')
    setExportMsg({ text:`✓ PDF mit ${filtered.length} Dokument(en).`, err:false })
    setTimeout(()=>setExportMsg(null),4000)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredDocs = filter==='Alle' ? docs : docs.filter(d=>d.kategorie===filter)
  const jahre = [...new Set(docs.map(d=>d.jahr||new Date().getFullYear()))].sort((a,b)=>b-a)
  const openTodos = allTodos.filter(t=>!t.erledigt).length
  const highTodos = allTodos.filter(t=>!t.erledigt && t.dringlichkeit==='hoch').length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>PostScout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✉</text></svg>" />
      </Head>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">✉</div>
            <div>
              <div className="logo-title">PostScout</div>
              <div className="logo-sub">Briefe verstehen – nichts verpassen</div>
            </div>
          </div>
          {session && (
            <button className="user-btn" onClick={signOut}>
              {session.user.email.split('@')[0]}<br/><span>Abmelden</span>
            </button>
          )}
        </header>

        {/* AUTH */}
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

        {/* APP */}
        {session && (
          <>
            {/* TABS */}
            <nav className="tabs">
              <button className={`tab ${tab==='todos'?'tab-active':''}`} onClick={()=>setTab('todos')}>
                Aufgaben{openTodos>0&&<span className={`tab-badge ${highTodos>0?'tab-badge-red':''}`}>{openTodos}</span>}
              </button>
              <button className={`tab ${tab==='scan'?'tab-active':''}`} onClick={()=>setTab('scan')}>
                Scannen
              </button>
              <button className={`tab ${tab==='archiv'?'tab-active':''}`} onClick={()=>{setTab('archiv');loadAll()}}>
                Archiv
              </button>
              <button className={`tab ${tab==='export'?'tab-active':''}`} onClick={()=>setTab('export')}>
                Export
              </button>
            </nav>

            {/* ── TODOS TAB ── */}
            {tab==='todos' && (
              <div>
                {/* Mail Draft Banner */}
                {mailDraft && (
                  <div className="mail-banner">
                    <div className="mail-banner-top">
                      <span className="mail-banner-ico">✉</span>
                      <div>
                        <div className="mail-banner-title">Antwort erforderlich</div>
                        <div className="mail-banner-sub">Eine E-Mail-Vorlage wurde erstellt</div>
                      </div>
                      <button className="mail-banner-close" onClick={()=>setMailDraft(null)}>✕</button>
                    </div>
                    <div className="mail-preview">
                      {mailDraft.betreff && <div className="mail-preview-row"><span>Betreff:</span> {mailDraft.betreff}</div>}
                      {mailDraft.text && <div className="mail-preview-body">{mailDraft.text.slice(0,120)}{mailDraft.text.length>120?'…':''}</div>}
                    </div>
                    <button className="btn-primary" onClick={()=>openMail(mailDraft)} style={{width:'100%',marginTop:8}}>
                      📬 In Apple Mail öffnen
                    </button>
                  </div>
                )}

                {allTodos.length===0 ? (
                  <div className="empty">
                    <div className="empty-ico">✅</div>
                    <p>Alle Aufgaben erledigt.</p>
                    <button className="btn-ghost" onClick={()=>setTab('scan')} style={{marginTop:12}}>Brief scannen →</button>
                  </div>
                ) : (
                  <>
                    <div className="todos-summary">
                      <span className="todos-count">{openTodos} offen</span>
                      {highTodos>0&&<span className="todos-urgent">{highTodos} dringend</span>}
                    </div>
                    {DRING_ORDER.map(dring => {
                      const group = allTodos.filter(t=>t.dringlichkeit===dring)
                      if (!group.length) return null
                      const d = DRING[dring]
                      const offen = group.filter(t=>!t.erledigt)
                      const erledigt = group.filter(t=>t.erledigt)
                      return (
                        <div key={dring} className="todo-group">
                          <div className="todo-group-label" style={{color:d.color}}>
                            <span className="todo-group-dot" style={{background:d.color}}/>
                            {d.label} · {offen.length} offen
                          </div>
                          {[...offen,...erledigt].map((t,i) => (
                            <div key={i} className={`todo-card ${t.erledigt?'todo-card-done':''}`}>
                              <button
                                className={`todo-check ${t.erledigt?'todo-check-done':''}`}
                                onClick={()=>toggleTodo(t.docId, t.todoIdx)}
                                aria-label={t.erledigt?'Als offen markieren':'Als erledigt markieren'}
                              >
                                {t.erledigt&&'✓'}
                              </button>
                              <div className="todo-content">
                                <div className="todo-aufgabe">{t.aufgabe}</div>
                                <div className="todo-meta">
                                  <span className="todo-doc">{t.catIco} {t.docName}</span>
                                  {t.frist&&<span className="todo-frist">📅 {new Date(t.frist+'T00:00:00').toLocaleDateString('de-DE')}</span>}
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

            {/* ── SCAN TAB ── */}
            {tab==='scan' && (
              <div>
                {/* Multi-photo upload */}
                <div className="section-label">Fotos / Seiten</div>
                <div
                  className="upload-zone"
                  onClick={()=>fileRef.current.click()}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('over')}}
                  onDragLeave={e=>e.currentTarget.classList.remove('over')}
                  onDrop={handleDrop}
                >
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
                    style={{display:'none'}} onChange={e=>{Array.from(e.target.files).forEach(f=>addPhoto(f));e.target.value=''}}/>
                  <div className="upload-ico">📷</div>
                  <div className="upload-title">{photos.length>0?'Weitere Seite hinzufügen':'Foto oder PDF aufnehmen'}</div>
                  <div className="upload-hint">Mehrere Seiten möglich – z.B. Vorder- und Rückseite</div>
                  <div className="upload-actions">
                    <button className="btn-primary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📷 Aufnehmen</button>
                    <button className="btn-secondary" onClick={e=>{e.stopPropagation();fileRef.current.click()}}>📁 Datei</button>
                  </div>
                </div>

                {/* Photo preview strip */}
                {photos.length>0&&(
                  <div className="photo-strip">
                    {photos.map((p,i)=>(
                      <div key={i} className="photo-thumb">
                        {p.previewUrl
                          ? <img src={p.previewUrl} className="photo-img" alt={`Seite ${i+1}`}/>
                          : <div className="photo-pdf">📄</div>}
                        <div className="photo-name">{i+1}. {p.file.name.slice(0,14)}</div>
                        <button className="photo-remove" onClick={()=>removePhoto(i)} aria-label="Entfernen">✕</button>
                      </div>
                    ))}
                    <button className="photo-add" onClick={()=>fileRef.current.click()}>
                      <span style={{fontSize:22}}>+</span>
                      <span style={{fontSize:11}}>Seite</span>
                    </button>
                  </div>
                )}

                {scanMsg&&<div className={`msg ${scanMsg.err?'msg-err':'msg-ok'}`}>{scanMsg.text}</div>}

                <button
                  className="btn-primary btn-full"
                  onClick={analyzeDoc}
                  disabled={!photos.length||analyzing}
                  style={{marginTop:4}}
                >
                  {analyzing?'Wird analysiert…':'✨ Brief analysieren'}
                </button>

                {analyzing&&(
                  <div className="analyzing-hint">
                    Claude liest den Brief – das dauert 10–20 Sekunden
                  </div>
                )}
              </div>
            )}

            {/* ── ARCHIV TAB ── */}
            {tab==='archiv' && (
              <div>
                <div className="stat-row">
                  <div className="stat-cell"><div className="stat-lbl">Dokumente</div><div className="stat-val">{docs.length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Steuerrelevant</div><div className="stat-val">{docs.filter(d=>d.steuerrelevant).length}</div></div>
                  <div className="stat-cell"><div className="stat-lbl">Offene Todos</div><div className="stat-val">{openTodos}</div></div>
                </div>
                <div className="section-label">Kategorie</div>
                <div className="chip-bar">
                  {['Alle',...Object.keys(CATS)].map(c=>(
                    <button key={c} className={`chip ${filter===c?'chip-active':''}`} onClick={()=>setFilter(c)}>{c}</button>
                  ))}
                </div>
                {filteredDocs.length===0
                  ? <div className="empty"><div className="empty-ico">📭</div><p>Keine Dokumente.</p></div>
                  : filteredDocs.map(d=>{
                    const cat=CATS[d.kategorie]||CATS['Sonstiges']
                    const dring=DRING[d.dringlichkeit]||DRING.niedrig
                    return (
                      <div key={d.id} className="doc-card">
                        <div className="doc-card-top">
                          <div className="doc-cat-ico" style={{background:cat.bg,color:cat.text}}>{cat.ico}</div>
                          <div className="doc-info">
                            <div className="doc-name">{d.absender||d.dateiname}</div>
                            <div className="doc-meta">
                              {d.kategorie} · {new Date(d.erstellt_am).toLocaleDateString('de-DE')}
                              {d.betrag!=null&&' · '+Number(d.betrag).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}
                            </div>
                          </div>
                          <span className="dring-pill" style={{background:dring.bg,color:dring.color,border:`0.5px solid ${dring.border}`}}>{dring.label}</span>
                        </div>
                        {d.zusammenfassung&&<p className="doc-summary">{d.zusammenfassung}</p>}
                        <div className="doc-actions">
                          <button className="btn-ghost btn-sm" onClick={()=>downloadDoc(d.storage_path,d.dateiname)}>⬇ Laden</button>
                          <button className="btn-ghost btn-sm btn-danger" onClick={()=>deleteDoc(d.id,d.storage_path)}>🗑 Löschen</button>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* ── EXPORT TAB ── */}
            {tab==='export' && (
              <div>
                <div className="section-label">Steuerjahr</div>
                <select className="year-sel" id="year-sel">
                  {(jahre.length?jahre:[new Date().getFullYear()]).map(j=><option key={j} value={j}>{j}</option>)}
                </select>
                <div className="export-card">
                  <div className="export-title">🔴 PDF für Steuerberater</div>
                  <div className="export-desc">Alle steuerrelevanten Dokumente mit Zusammenfassung, Betrag und Fristen – druckfertig.</div>
                  <button className="btn-primary" onClick={exportPDF}>⬇ PDF herunterladen</button>
                </div>
                <div className="export-card">
                  <div className="export-title">🟢 CSV für Excel / DATEV</div>
                  <div className="export-desc">Tabellarische Übersicht aller steuerrelevanten Belege – direkt importierbar.</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="btn-primary" onClick={()=>exportCSV(true)}>⬇ Steuer-CSV</button>
                    <button className="btn-secondary" onClick={()=>exportCSV(false)}>⬇ Alle</button>
                  </div>
                </div>
                {exportMsg&&<div className={`msg ${exportMsg.err?'msg-err':'msg-ok'}`}>{exportMsg.text}</div>}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --ease-out:cubic-bezier(0.23,1,0.32,1);
          --bg:#f5f4f0;--surface:#fff;--surface2:#ededea;
          --border:#e2e0d8;--border2:#ccc9be;
          --text:#1a1916;--text2:#5a5850;--text3:#9a978e;
          --accent:#2563eb;--accent-h:#1d4ed8;--accent-bg:#eff6ff;
          --radius:10px;
        }
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
        .app{max-width:460px;margin:0 auto;padding:1.25rem 1rem 5rem}

        /* Header */
        .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
        .logo{display:flex;align-items:center;gap:10px}
        .logo-icon{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;flex-shrink:0}
        .logo-title{font-size:17px;font-weight:600}
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

        /* Tabs */
        .tabs{display:flex;gap:3px;margin-bottom:1.25rem;background:var(--surface2);border-radius:11px;padding:3px}
        .tab{flex:1;padding:8px 2px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;color:var(--text3);border:none;background:transparent;transition:background 140ms,color 140ms;font-family:inherit;position:relative;display:flex;align-items:center;justify-content:center;gap:4px}
        .tab-active{background:var(--surface);color:var(--text)}
        .tab-badge{background:#e4e2d9;color:var(--text2);border-radius:20px;font-size:10px;font-weight:600;padding:1px 6px;min-width:18px;text-align:center}
        .tab-badge-red{background:#fecaca;color:#991b1b}

        /* Buttons */
        .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:14px;font-family:inherit;cursor:pointer;font-weight:500;transition:background 140ms var(--ease-out),transform 100ms var(--ease-out)}
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

        /* Section label */
        .section-label{font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px}

        /* Upload zone */
        .upload-zone{border:1.5px dashed var(--border2);border-radius:14px;padding:1.5rem 1rem;text-align:center;cursor:pointer;transition:border-color 160ms,background 160ms;margin-bottom:10px}
        .upload-zone:hover,.upload-zone.over{border-color:var(--accent);background:var(--accent-bg)}
        .upload-ico{font-size:26px;margin-bottom:6px}
        .upload-title{font-size:14px;font-weight:500;margin-bottom:3px}
        .upload-hint{font-size:12px;color:var(--text3);margin-bottom:10px}
        .upload-actions{display:flex;gap:8px;justify-content:center}

        /* Photo strip */
        .photo-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px;margin-bottom:8px;scrollbar-width:none}
        .photo-strip::-webkit-scrollbar{display:none}
        .photo-thumb{position:relative;flex-shrink:0;width:72px}
        .photo-img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:0.5px solid var(--border)}
        .photo-pdf{width:72px;height:72px;border-radius:8px;border:0.5px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px}
        .photo-name{font-size:10px;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .photo-remove{position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#dc2626;color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;line-height:1}
        .photo-add{flex-shrink:0;width:72px;height:72px;border-radius:8px;border:1.5px dashed var(--border2);background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text3);font-family:inherit;transition:background 120ms;gap:2px}
        .photo-add:hover{background:var(--surface2)}

        /* Analyzing hint */
        .analyzing-hint{text-align:center;font-size:12px;color:var(--text3);margin-top:8px}

        /* Todos */
        .todos-summary{display:flex;align-items:center;gap:10px;margin-bottom:1rem;padding:10px 14px;background:var(--surface);border:0.5px solid var(--border);border-radius:11px}
        .todos-count{font-size:15px;font-weight:600}
        .todos-urgent{font-size:12px;font-weight:500;background:#fef2f2;color:#991b1b;border:0.5px solid #fecaca;border-radius:20px;padding:2px 10px}
        .todo-group{margin-bottom:1.25rem}
        .todo-group-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:0.04em}
        .todo-group-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .todo-card{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;background:var(--surface);border:0.5px solid var(--border);border-radius:11px;margin-bottom:6px;transition:opacity 200ms}
        .todo-card-done{opacity:0.5}
        .todo-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border2);flex-shrink:0;margin-top:1px;cursor:pointer;background:transparent;font-size:12px;color:#fff;display:flex;align-items:center;justify-content:center;transition:background 140ms,border-color 140ms;font-family:inherit}
        .todo-check-done{background:#16a34a;border-color:#16a34a}
        .todo-content{flex:1;min-width:0}
        .todo-aufgabe{font-size:14px;color:var(--text);line-height:1.4;margin-bottom:4px}
        .todo-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .todo-doc{font-size:11px;color:var(--text3)}
        .todo-frist{font-size:11px;color:#d97706;font-weight:500}

        /* Mail banner */
        .mail-banner{background:#eff6ff;border:0.5px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:1rem}
        .mail-banner-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .mail-banner-ico{font-size:22px;flex-shrink:0}
        .mail-banner-title{font-size:14px;font-weight:600;color:#1e40af}
        .mail-banner-sub{font-size:12px;color:#3b82f6}
        .mail-banner-close{margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:16px;color:#93c5fd;padding:2px 6px}
        .mail-preview{background:#fff;border-radius:8px;padding:10px 12px;margin-bottom:4px}
        .mail-preview-row{font-size:12px;color:var(--text2);margin-bottom:4px}
        .mail-preview-row span{font-weight:500;color:var(--text)}
        .mail-preview-body{font-size:12px;color:var(--text3);line-height:1.5}

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

        /* Export */
        .export-card{background:var(--surface);border:0.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px}
        .export-title{font-size:14px;font-weight:500;margin-bottom:4px}
        .export-desc{font-size:13px;color:var(--text2);margin-bottom:10px;line-height:1.5}
        .year-sel{padding:8px 12px;border-radius:8px;border:0.5px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;margin-bottom:12px;cursor:pointer}

        /* Msgs */
        .msg{border-radius:9px;padding:10px 13px;font-size:13px;margin-bottom:10px;line-height:1.5}
        .msg-err{background:#fef2f2;color:#991b1b;border:0.5px solid #fecaca}
        .msg-ok{background:#f0fdf4;color:#15803d;border:0.5px solid #bbf7d0}

        /* Empty */
        .empty{text-align:center;padding:2.5rem 1rem;color:var(--text3)}
        .empty-ico{font-size:32px;margin-bottom:10px}
        .empty p{font-size:14px}

        @media(prefers-reduced-motion:reduce){
          .todo-card,.tab,.btn-primary,.btn-secondary,.btn-ghost,.upload-zone,.chip,.todo-check{transition:none}
        }
      `}</style>
    </>
  )
}
