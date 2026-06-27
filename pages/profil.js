import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

export default function Profil() {
  const [session, setSession] = useState(null)
  const [profil, setProfil] = useState({
    vorname:'', nachname:'', strasse:'', hausnummer:'', plz:'', ort:'',
    geburtsdatum:'', steuer_id:'', iban:'', bic:'', bank_name:'', telefon:''
  })
  const [mieter, setMieter] = useState([])
  const [neuerMieter, setNeuerMieter] = useState({
    vorname:'', nachname:'', email:'', telefon:'',
    strasse:'', hausnummer:'', plz:'', ort:'', objekt_bezeichnung:''
  })
  const [imapSettings, setImapSettings] = useState({
    host:'secureimap.t-online.de', port:993, username:'', password_encrypted:'', aktiv:true
  })
  const [imapHasConfig, setImapHasConfig] = useState(false)
  const [activeSection, setActiveSection] = useState('person')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [imapTesting, setImapTesting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) { loadProfil(session.user.id); loadMieter(session.user.id); loadImapSettings(session.user.id) }
    })
  }, [])

  async function loadProfil(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfil(p => ({ ...p, ...data }))
  }

  async function loadMieter(uid) {
    const { data } = await supabase.from('mieter').select('*').eq('user_id', uid).order('nachname')
    setMieter(data || [])
  }

  async function loadImapSettings(uid) {
    const { data } = await supabase.from('imap_settings').select('*').eq('user_id', uid).single()
    if (data) { setImapSettings(data); setImapHasConfig(true) }
  }

  async function saveProfil() {
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('profiles').update(profil).eq('id', session.user.id)
    setMsg(error ? { text: error.message, err: true } : { text: 'Profil gespeichert ✓', err: false })
    setSaving(false); setTimeout(() => setMsg(null), 3000)
  }

  async function saveMieter() {
    if (!neuerMieter.vorname || !neuerMieter.nachname) return
    const { error } = await supabase.from('mieter').insert({ ...neuerMieter, user_id: session.user.id })
    if (!error) {
      setNeuerMieter({ vorname:'', nachname:'', email:'', telefon:'', strasse:'', hausnummer:'', plz:'', ort:'', objekt_bezeichnung:'' })
      loadMieter(session.user.id)
      setMsg({ text: 'Mieter gespeichert ✓', err: false }); setTimeout(() => setMsg(null), 3000)
    }
  }

  async function deleteMieter(id) {
    if (!confirm('Mieter wirklich löschen?')) return
    await supabase.from('mieter').delete().eq('id', id)
    loadMieter(session.user.id)
  }

  async function saveImapSettings() {
    setSaving(true); setMsg(null)
    const data = { ...imapSettings, user_id: session.user.id }
    const { error } = await supabase.from('imap_settings').upsert(data, { onConflict: 'user_id' })
    if (!error) { setImapHasConfig(true); setMsg({ text: 'IMAP gespeichert ✓', err: false }) }
    else setMsg({ text: error.message, err: true })
    setSaving(false); setTimeout(() => setMsg(null), 3000)
  }

  async function testImap() {
    setImapTesting(true); setMsg(null)
    const res = await fetch('/api/imap-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imapSettings),
    })
    const data = await res.json()
    setMsg(data.ok ? { text: `✓ Verbindung erfolgreich – ${data.count} ungelesene Mails`, err: false } : { text: data.error, err: true })
    setImapTesting(false)
  }

  const sections = [
    { id: 'person', label: '👤 Person' },
    { id: 'bank', label: '🏦 Bank' },
    { id: 'mieter', label: '🏠 Mieter' },
    { id: 'imap', label: '📧 E-Mail' },
  ]

  const Field = ({ label, value, onChange, type='text', placeholder='' }) => (
    <div style={{marginBottom:10}}>
      <label style={{fontSize:12,fontWeight:500,color:'#5a5850',display:'block',marginBottom:5}}>{label}</label>
      <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid #ccc9be',background:'#fff',color:'#1a1916',fontSize:14,fontFamily:'inherit'}}/>
    </div>
  )

  return (
    <>
      <Head><title>Profil – PostScout</title><meta name="viewport" content="width=device-width, initial-scale=1"/></Head>
      <div style={{maxWidth:460,margin:'0 auto',padding:'1.25rem 1rem 5rem',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',background:'#f5f4f0',minHeight:'100vh'}}>

        {/* Header */}
        <header style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1.5rem'}}>
          <a href="/" style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:8,padding:'7px 12px',fontSize:13,color:'#5a5850',textDecoration:'none'}}>← Zurück</a>
          <span style={{fontSize:17,fontWeight:600}}>Mein Profil</span>
        </header>

        {/* Section tabs */}
        <div style={{display:'flex',gap:4,marginBottom:'1.25rem',background:'#ededea',borderRadius:11,padding:3}}>
          {sections.map(s => (
            <button key={s.id} onClick={()=>setActiveSection(s.id)}
              style={{flex:1,padding:'7px 2px',borderRadius:8,fontSize:11,fontWeight:500,cursor:'pointer',border:'none',
                background:activeSection===s.id?'#fff':'transparent',color:activeSection===s.id?'#1a1916':'#9a978e',fontFamily:'inherit',whiteSpace:'nowrap'}}>
              {s.label}
            </button>
          ))}
        </div>

        {msg && <div style={{borderRadius:9,padding:'10px 13px',fontSize:13,marginBottom:12,background:msg.err?'#fef2f2':'#f0fdf4',color:msg.err?'#991b1b':'#15803d',border:`0.5px solid ${msg.err?'#fecaca':'#bbf7d0'}`}}>{msg.text}</div>}

        {/* PERSON */}
        {activeSection==='person' && (
          <div style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:12,padding:16}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Persönliche Daten</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Vorname" value={profil.vorname} onChange={v=>setProfil(p=>({...p,vorname:v}))}/>
              <Field label="Nachname" value={profil.nachname} onChange={v=>setProfil(p=>({...p,nachname:v}))}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}>
              <Field label="Straße" value={profil.strasse} onChange={v=>setProfil(p=>({...p,strasse:v}))}/>
              <Field label="Nr." value={profil.hausnummer} onChange={v=>setProfil(p=>({...p,hausnummer:v}))}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:8}}>
              <Field label="PLZ" value={profil.plz} onChange={v=>setProfil(p=>({...p,plz:v}))}/>
              <Field label="Ort" value={profil.ort} onChange={v=>setProfil(p=>({...p,ort:v}))}/>
            </div>
            <Field label="Geburtsdatum" value={profil.geburtsdatum} onChange={v=>setProfil(p=>({...p,geburtsdatum:v}))} type="date"/>
            <Field label="Telefon" value={profil.telefon} onChange={v=>setProfil(p=>({...p,telefon:v}))} placeholder="+49 ..."/>
            <Field label="Steuer-ID" value={profil.steuer_id} onChange={v=>setProfil(p=>({...p,steuer_id:v}))} placeholder="11 stellige Steuer-ID"/>
            <button onClick={saveProfil} disabled={saving}
              style={{width:'100%',padding:12,borderRadius:9,border:'none',background:'#2563eb',color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',marginTop:4}}>
              {saving?'Speichern...':'Speichern'}
            </button>
          </div>
        )}

        {/* BANK */}
        {activeSection==='bank' && (
          <div style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:12,padding:16}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Bankverbindung</div>
            <Field label="Bank / Institut" value={profil.bank_name} onChange={v=>setProfil(p=>({...p,bank_name:v}))} placeholder="z.B. Deutsche Bank"/>
            <Field label="IBAN" value={profil.iban} onChange={v=>setProfil(p=>({...p,iban:v}))} placeholder="DE00 ..."/>
            <Field label="BIC" value={profil.bic} onChange={v=>setProfil(p=>({...p,bic:v}))} placeholder="XXXXXXXX"/>
            <div style={{fontSize:12,color:'#9a978e',marginBottom:12,padding:'8px 10px',background:'#f5f4f0',borderRadius:8}}>
              ⚠️ Diese Daten werden nur für Anschreiben-Vorlagen genutzt und niemals weitergegeben.
            </div>
            <button onClick={saveProfil} disabled={saving}
              style={{width:'100%',padding:12,borderRadius:9,border:'none',background:'#2563eb',color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer'}}>
              {saving?'Speichern...':'Speichern'}
            </button>
          </div>
        )}

        {/* MIETER */}
        {activeSection==='mieter' && (
          <div>
            {/* Existing */}
            {mieter.length>0 && mieter.map(m => (
              <div key={m.id} style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:12,padding:12,marginBottom:8}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{m.vorname} {m.nachname}</div>
                    <div style={{fontSize:12,color:'#9a978e',marginTop:2}}>
                      {m.objekt_bezeichnung && <span>{m.objekt_bezeichnung} · </span>}
                      {m.strasse} {m.hausnummer}, {m.plz} {m.ort}
                    </div>
                    {m.email && <div style={{fontSize:12,color:'#2563eb',marginTop:2}}>{m.email}</div>}
                    {m.telefon && <div style={{fontSize:12,color:'#5a5850',marginTop:1}}>{m.telefon}</div>}
                  </div>
                  <button onClick={()=>deleteMieter(m.id)}
                    style={{background:'transparent',border:'0.5px solid #e2e0d8',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:13,color:'#9a978e'}}>✕</button>
                </div>
              </div>
            ))}

            {/* New mieter form */}
            <div style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:12,padding:16}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Mieter hinzufügen</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Field label="Vorname *" value={neuerMieter.vorname} onChange={v=>setNeuerMieter(m=>({...m,vorname:v}))}/>
                <Field label="Nachname *" value={neuerMieter.nachname} onChange={v=>setNeuerMieter(m=>({...m,nachname:v}))}/>
              </div>
              <Field label="Objekt / Wohnung" value={neuerMieter.objekt_bezeichnung} onChange={v=>setNeuerMieter(m=>({...m,objekt_bezeichnung:v}))} placeholder="z.B. EG links, Musterstr. 1"/>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}>
                <Field label="Straße" value={neuerMieter.strasse} onChange={v=>setNeuerMieter(m=>({...m,strasse:v}))}/>
                <Field label="Nr." value={neuerMieter.hausnummer} onChange={v=>setNeuerMieter(m=>({...m,hausnummer:v}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:8}}>
                <Field label="PLZ" value={neuerMieter.plz} onChange={v=>setNeuerMieter(m=>({...m,plz:v}))}/>
                <Field label="Ort" value={neuerMieter.ort} onChange={v=>setNeuerMieter(m=>({...m,ort:v}))}/>
              </div>
              <Field label="E-Mail" value={neuerMieter.email} onChange={v=>setNeuerMieter(m=>({...m,email:v}))} type="email"/>
              <Field label="Telefon" value={neuerMieter.telefon} onChange={v=>setNeuerMieter(m=>({...m,telefon:v}))}/>
              <button onClick={saveMieter} disabled={!neuerMieter.vorname||!neuerMieter.nachname}
                style={{width:'100%',padding:12,borderRadius:9,border:'none',background:'#2563eb',color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',opacity:(!neuerMieter.vorname||!neuerMieter.nachname)?0.5:1}}>
                Mieter hinzufügen
              </button>
            </div>
          </div>
        )}

        {/* IMAP */}
        {activeSection==='imap' && (
          <div style={{background:'#fff',border:'0.5px solid #e2e0d8',borderRadius:12,padding:16}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>E-Mail Postfach verbinden</div>
            <div style={{fontSize:12,color:'#9a978e',marginBottom:14,lineHeight:1.5}}>
              PostScout liest stündlich neue Mails und analysiert sie automatisch. Anhänge werden ebenfalls gespeichert.
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {[
                {label:'T-Online',host:'secureimap.t-online.de'},
                {label:'Gmail',host:'imap.gmail.com'},
                {label:'iCloud',host:'imap.mail.me.com'},
                {label:'GMX',host:'imap.gmx.net'},
              ].map(p=>(
                <button key={p.host} onClick={()=>setImapSettings(s=>({...s,host:p.host}))}
                  style={{flex:1,padding:'6px 4px',borderRadius:7,border:'0.5px solid',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',
                    background:imapSettings.host===p.host?'#eff6ff':'#fff',
                    color:imapSettings.host===p.host?'#1e40af':'#5a5850',
                    borderColor:imapSettings.host===p.host?'#bfdbfe':'#e2e0d8'}}>
                  {p.label}
                </button>
              ))}
            </div>
            <Field label="IMAP Server" value={imapSettings.host} onChange={v=>setImapSettings(s=>({...s,host:v}))}/>
            <Field label="E-Mail Adresse" value={imapSettings.username} onChange={v=>setImapSettings(s=>({...s,username:v}))} type="email" placeholder="deine@email.de"/>
            <Field label="App-Passwort" value={imapSettings.password_encrypted} onChange={v=>setImapSettings(s=>({...s,password_encrypted:v}))} type="password" placeholder="App-Passwort (nicht dein normales)"/>
            <div style={{fontSize:11,color:'#9a978e',marginBottom:12,lineHeight:1.5}}>
              💡 T-Online: mein.t-online.de → Sicherheit → App-Passwörter<br/>
              Gmail: Google-Konto → Sicherheit → 2FA → App-Passwörter
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={testImap} disabled={imapTesting||!imapSettings.username||!imapSettings.password_encrypted}
                style={{flex:1,padding:10,borderRadius:9,border:'0.5px solid #ccc9be',background:'#fff',color:'#1a1916',fontSize:13,fontWeight:500,cursor:'pointer',opacity:(!imapSettings.username||!imapSettings.password_encrypted)?0.5:1}}>
                {imapTesting?'Teste...':'Verbindung testen'}
              </button>
              <button onClick={saveImapSettings} disabled={saving||!imapSettings.username||!imapSettings.password_encrypted}
                style={{flex:1,padding:10,borderRadius:9,border:'none',background:'#2563eb',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',opacity:(!imapSettings.username||!imapSettings.password_encrypted)?0.5:1}}>
                {saving?'Speichern...':'Speichern'}
              </button>
            </div>
            {imapHasConfig && (
              <div style={{marginTop:12,padding:'8px 12px',background:'#f0fdf4',border:'0.5px solid #bbf7d0',borderRadius:8,fontSize:12,color:'#15803d'}}>
                ✓ IMAP verbunden – PostScout synct stündlich automatisch
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
