import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = 'currentColor', strokeWidth = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  check: 'M20 6L9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  circle: 'M12 22C17.523 22 22 17.523 22 12S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 0l8 8 8-8',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 8a16 16 0 006.07 6.07l1.36-1.36a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  warning: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  clock: 'M12 22C17.523 22 22 17.523 22 12S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-10V7m0 5l3 3',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M18 15l-6-6-6 6',
  fileText: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6M16 13H8M16 17H8M10 9H8',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM9 22V12h6v10',
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  archive: 'M21 8v13H3V8M23 3H1a1 1 0 00-1 1v3a1 1 0 001 1h22a1 1 0 001-1V4a1 1 0 00-1-1zM10 12h4',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  x: 'M18 6L6 18M6 6l12 12',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 16a4 4 0 100-8 4 4 0 000 8z',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  pen: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  info: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-10v4m0-8h.01',
};

// ── Date helpers ────────────────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return null;
  // already a Date
  if (raw instanceof Date) return isNaN(raw) ? null : raw;
  // ISO string
  const d = new Date(raw);
  if (!isNaN(d)) return d;
  // German formats: dd.mm.yyyy or dd.mm.yy
  const match = String(raw).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (match) {
    let [, day, month, year] = match;
    if (year.length === 2) year = '20' + year;
    const d2 = new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);
    if (!isNaN(d2)) return d2;
  }
  return null;
}

function formatDate(raw) {
  const d = parseDate(raw);
  if (!d) return null; // null means "needs manual entry"
  const now = new Date();
  const diffDays = Math.ceil((d - now) / 86400000);
  const formatted = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (diffDays < 0) return { label: `Überfällig seit ${Math.abs(diffDays)}d`, formatted, urgent: true, overdue: true };
  if (diffDays === 0) return { label: 'Heute fällig', formatted, urgent: true, overdue: false };
  if (diffDays <= 3) return { label: `${diffDays} Tage`, formatted, urgent: true, overdue: false };
  if (diffDays <= 14) return { label: `${diffDays} Tage`, formatted, urgent: false, overdue: false };
  return { label: formatted, formatted, urgent: false, overdue: false };
}

// ── Urgency config ──────────────────────────────────────────────────────────
const URGENCY = {
  'ueberfaellig': { label: 'Überfällig',        color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444', rank: 0 },
  'hoch':         { label: 'Dringend',           color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316', rank: 1 },
  'mittel':       { label: 'Mittelfristig',      color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', rank: 2 },
  'niedrig':      { label: 'Zur Kenntnis',       color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', rank: 3 },
  'ignorieren':   { label: 'Werbung/Ignorieren', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF', rank: 4 },
};

// ── Bottom Nav ──────────────────────────────────────────────────────────────
function BottomNav({ active }) {
  const router = useRouter();
  const items = [
    { id: 'home',     label: 'Start',    icon: icons.home,     path: '/' },
    { id: 'aufgaben', label: 'Aufgaben', icon: icons.fileText,  path: '/aufgaben' },
    { id: 'scannen',  label: 'Scannen',  icon: icons.camera,   path: '/scannen' },
    { id: 'archiv',   label: 'Archiv',   icon: icons.archive,  path: '/archiv' },
    { id: 'familie',  label: 'Familie',  icon: icons.users,    path: '/familie' },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(251,250,248,0.97)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid #EFEDE6',
      display: 'flex', zIndex: 100,
      padding: `8px 4px max(20px, env(safe-area-inset-bottom))`,
    }}>
      {items.map(it => {
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => router.push(it.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '2px 4px', border: 'none', background: 'none',
              color: isActive ? '#1F3A52' : '#B0ADA4', cursor: 'pointer',
              fontSize: 10, fontFamily: 'inherit', fontWeight: isActive ? 700 : 500,
              transition: 'color 150ms',
            }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 30, borderRadius: 15,
              background: isActive ? '#EAF0F4' : 'transparent',
              transition: 'background 150ms',
            }}>
              <Icon d={it.icon} size={20} />
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// ── Date Edit Modal ─────────────────────────────────────────────────────────
function DateEditModal({ task, onSave, onClose }) {
  const [val, setVal] = useState('');
  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,
      display:'flex',alignItems:'flex-end',justifyContent:'center'
    }} onClick={onClose}>
      <div style={{
        background:'#fff',borderRadius:'16px 16px 0 0',padding:24,width:'100%',maxWidth:480
      }} onClick={e=>e.stopPropagation()}>
        <p style={{margin:'0 0 4px',fontWeight:600,color:'#111'}}>Datum nachtragen</p>
        <p style={{margin:'0 0 16px',fontSize:13,color:'#6B7280'}}>{task.beschreibung?.slice(0,80)}</p>
        <input
          type="date"
          value={val}
          onChange={e=>setVal(e.target.value)}
          style={{
            width:'100%',border:'1px solid #D1D5DB',borderRadius:8,padding:'10px 12px',
            fontSize:15,fontFamily:'inherit',boxSizing:'border-box',marginBottom:16,
          }}
        />
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{
            flex:1,padding:'12px',border:'1px solid #E5E7EB',borderRadius:8,background:'#fff',
            fontSize:14,fontFamily:'inherit',cursor:'pointer',color:'#374151',
          }}>Abbrechen</button>
          <button onClick={()=>val&&onSave(val)} style={{
            flex:2,padding:'12px',border:'none',borderRadius:8,background:'#1F3A52',
            fontSize:14,fontFamily:'inherit',cursor:'pointer',color:'#fff',fontWeight:600,
          }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Reply Modal ─────────────────────────────────────────────────────────────
function ReplyModal({ task, dokument, onClose }) {
  const [withDraft, setWithDraft] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const recipient = dokument?.absender || task?.empfaenger || '';
  const subject = `AW: ${dokument?.titel || dokument?.dateiname || 'Ihr Schreiben'}`;
  const emailHint = dokument?.absender_email || '';

  async function generateDraft() {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dokumentId: dokument?.id,
          aufgabe: task?.beschreibung,
          absender: recipient,
          betreff: subject,
        }),
      });
      const data = await res.json();
      setDraft(data.text || '');
    } catch {
      setDraft('Fehler beim Generieren. Bitte manuell ausfüllen.');
    }
    setLoading(false);
  }

  function openMail() {
    const body = encodeURIComponent(draft || '');
    const subj = encodeURIComponent(subject);
    const to = encodeURIComponent(emailHint);
    window.location.href = `mailto:${to}?subject=${subj}&body=${body}`;
  }

  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:200,
      display:'flex',alignItems:'flex-end',justifyContent:'center'
    }} onClick={onClose}>
      <div style={{
        background:'#fff',borderRadius:'16px 16px 0 0',padding:24,width:'100%',maxWidth:480,
        maxHeight:'85vh',overflowY:'auto',
      }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <p style={{margin:0,fontWeight:700,fontSize:17,color:'#111'}}>Antwort verfassen</p>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
            <Icon d={icons.x} size={20} color="#6B7280" />
          </button>
        </div>

        {/* Pre-filled fields */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.05em',textTransform:'uppercase'}}>
            Empfänger
          </label>
          <div style={{
            marginTop:4,padding:'10px 12px',background:'#F9FAFB',border:'1px solid #E5E7EB',
            borderRadius:8,fontSize:14,color:'#111',
          }}>
            {recipient || <span style={{color:'#9CA3AF'}}>Bitte manuell eintragen</span>}
          </div>
        </div>
        {emailHint && (
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.05em',textTransform:'uppercase'}}>E-Mail</label>
            <div style={{marginTop:4,padding:'10px 12px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,color:'#111'}}>{emailHint}</div>
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.05em',textTransform:'uppercase'}}>Betreff</label>
          <div style={{marginTop:4,padding:'10px 12px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,color:'#111'}}>{subject}</div>
        </div>

        {/* Draft toggle */}
        {!withDraft ? (
          <button onClick={()=>{setWithDraft(true);generateDraft();}} style={{
            width:'100%',padding:'12px',border:'1px dashed #1F3A52',borderRadius:10,
            background:'#F0F4F8',fontSize:14,fontFamily:'inherit',cursor:'pointer',
            color:'#1F3A52',fontWeight:600,marginBottom:12,display:'flex',alignItems:'center',
            justifyContent:'center',gap:8,
          }}>
            <Icon d={icons.pen} size={16} />
            KI-Antwortvorschlag erstellen
          </button>
        ) : (
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.05em',textTransform:'uppercase'}}>Antworttext</label>
            {loading ? (
              <div style={{marginTop:8,padding:16,background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,color:'#6B7280',fontSize:13}}>
                Vorschlag wird erstellt…
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                rows={7}
                style={{
                  marginTop:4,width:'100%',border:'1px solid #D1D5DB',borderRadius:8,
                  padding:'10px 12px',fontSize:14,fontFamily:'inherit',resize:'vertical',
                  boxSizing:'border-box',lineHeight:1.6,
                }}
              />
            )}
          </div>
        )}

        <button onClick={openMail} style={{
          width:'100%',padding:'14px',border:'none',borderRadius:10,background:'#1F3A52',
          fontSize:15,fontFamily:'inherit',cursor:'pointer',color:'#fff',fontWeight:700,
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        }}>
          <Icon d={icons.mail} size={18} color="#fff" />
          In Mail öffnen
        </button>
      </div>
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, dokument, onToggle, onDateEdit, onReply, onViewDoc }) {
  const [expanded, setExpanded] = useState(false);
  const urg = URGENCY[task.dringlichkeit] || URGENCY['niedrig'];
  const dateInfo = task.faelligkeitsdatum ? formatDate(task.faelligkeitsdatum) : null;
  const needsDate = !dateInfo && task.faelligkeitsdatum; // had a value but couldn't parse
  const hasReply = task.antwort_erforderlich || task.typ === 'antwort';

  return (
    <div style={{
      background:'#fff',borderRadius:12,border:`1px solid ${urg.border}`,
      marginBottom:10,overflow:'hidden',
      boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
      opacity: task.erledigt ? 0.55 : 1,
    }}>
      {/* Main row */}
      <div style={{display:'flex',gap:12,padding:'14px 14px 10px'}}>
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task)}
          style={{
            width:24,height:24,borderRadius:'50%',border:`2px solid ${task.erledigt ? '#22C55E' : urg.dot}`,
            background: task.erledigt ? '#22C55E' : 'transparent',
            flexShrink:0,marginTop:1,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          }}>
          {task.erledigt && <Icon d={icons.check} size={13} color="#fff" strokeWidth={2.5} />}
        </button>

        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          {/* Absender + urgency */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5,flexWrap:'wrap'}}>
            <span style={{
              fontSize:10,fontWeight:700,color:urg.color,letterSpacing:'0.08em',textTransform:'uppercase',
            }}>{urg.label || task.dringlichkeit}</span>
            {dokument?.absender && (
              <span style={{fontSize:11,color:'#6B7280',background:'#F3F4F6',padding:'1px 6px',borderRadius:4}}>
                {dokument.absender}
              </span>
            )}
          </div>

          {/* Beschreibung */}
          <p style={{
            margin:'0 0 8px',fontSize:14,color: task.erledigt ? '#9CA3AF' : '#111',
            lineHeight:1.45,fontWeight:500,
            textDecoration: task.erledigt ? 'line-through' : 'none',
          }}>
            {task.beschreibung}
          </p>

          {/* Date pill */}
          {dateInfo && (
            <div style={{display:'inline-flex',alignItems:'center',gap:4,marginBottom:6}}>
              <span style={{
                fontSize:11,fontWeight:600,
                color: dateInfo.overdue ? '#B91C1C' : dateInfo.urgent ? '#C2410C' : '#6B7280',
                background: dateInfo.overdue ? '#FEF2F2' : dateInfo.urgent ? '#FFF7ED' : '#F3F4F6',
                padding:'2px 8px',borderRadius:20,display:'flex',alignItems:'center',gap:3,
              }}>
                <Icon d={icons.calendar} size={11} color={dateInfo.overdue ? '#B91C1C' : dateInfo.urgent ? '#C2410C' : '#9CA3AF'} />
                {dateInfo.label}
                <span style={{opacity:0.6}}>({dateInfo.formatted})</span>
              </span>
            </div>
          )}
          {needsDate && (
            <button onClick={()=>onDateEdit(task)} style={{
              display:'inline-flex',alignItems:'center',gap:4,marginBottom:6,
              fontSize:11,fontWeight:600,color:'#C2410C',background:'#FFF7ED',
              padding:'3px 10px',borderRadius:20,border:'1px dashed #FED7AA',cursor:'pointer',
            }}>
              <Icon d={icons.calendar} size={11} color="#C2410C" />
              Datum eintragen
            </button>
          )}

          {/* Action Buttons */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:2}}>
            {hasReply && !task.erledigt && (
              <button onClick={()=>onReply(task, dokument)} style={{
                display:'inline-flex',alignItems:'center',gap:5,
                padding:'6px 12px',borderRadius:8,border:'1px solid #1F3A52',
                background:'#1F3A52',color:'#fff',fontSize:12,fontWeight:600,
                cursor:'pointer',fontFamily:'inherit',
              }}>
                <Icon d={icons.mail} size={13} color="#fff" />
                Antwort verfassen
              </button>
            )}
            {dokument && (
              <button onClick={()=>onViewDoc(dokument)} style={{
                display:'inline-flex',alignItems:'center',gap:5,
                padding:'6px 10px',borderRadius:8,border:'1px solid #E5E7EB',
                background:'#fff',color:'#374151',fontSize:12,fontWeight:500,
                cursor:'pointer',fontFamily:'inherit',
              }}>
                <Icon d={icons.eye} size={13} color="#6B7280" />
                Dokument
              </button>
            )}
            <button onClick={()=>setExpanded(x=>!x)} style={{
              display:'inline-flex',alignItems:'center',gap:4,
              padding:'6px 10px',borderRadius:8,border:'1px solid #E5E7EB',
              background:'#fff',color:'#6B7280',fontSize:12,
              cursor:'pointer',fontFamily:'inherit',
            }}>
              <Icon d={expanded ? icons.chevronUp : icons.chevronDown} size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: Empfehlung / Zusammenfassung */}
      {expanded && dokument && (
        <div style={{
          borderTop:'1px solid #F3F4F6',padding:'12px 14px',
          background:'#FAFAFA',
        }}>
          {dokument.zusammenfassung && (
            <div style={{marginBottom:10}}>
              <p style={{margin:'0 0 4px',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.07em'}}>Zusammenfassung</p>
              <p style={{margin:0,fontSize:13,color:'#374151',lineHeight:1.5}}>{dokument.zusammenfassung}</p>
            </div>
          )}
          {task.empfehlung && (
            <div style={{
              background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'10px 12px',
            }}>
              <p style={{margin:'0 0 3px',fontSize:10,fontWeight:700,color:'#1D4ED8',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                Empfehlung
              </p>
              <p style={{margin:0,fontSize:13,color:'#1E3A8A',lineHeight:1.5}}>{task.empfehlung}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document Detail Modal ───────────────────────────────────────────────────
function DocModal({ dok, onClose }) {
  if (!dok) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,display:'flex',alignItems:'flex-end'}}
      onClick={onClose}>
      <div style={{
        background:'#fff',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:480,
        maxHeight:'80vh',display:'flex',flexDirection:'column',
      }} onClick={e=>e.stopPropagation()}>
        <div style={{background:'#1F3A52',padding:'16px 20px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <p style={{margin:0,fontWeight:700,color:'#fff',fontSize:16}}>{dok.titel || dok.dateiname}</p>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
            <Icon d={icons.x} size={20} color="#fff" />
          </button>
        </div>
        <div style={{overflowY:'auto',padding:20,flex:1}}>
          {dok.absender && <p style={{margin:'0 0 8px',fontSize:13,color:'#6B7280'}}>Von: <strong style={{color:'#111'}}>{dok.absender}</strong></p>}
          {dok.zusammenfassung && (
            <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
              <p style={{margin:'0 0 4px',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase'}}>Zusammenfassung</p>
              <p style={{margin:0,fontSize:14,color:'#111',lineHeight:1.6}}>{dok.zusammenfassung}</p>
            </div>
          )}
          {dok.bild_url && (
            <img src={dok.bild_url} alt="Dokument" style={{width:'100%',borderRadius:8,border:'1px solid #E5E7EB'}} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Aufgaben() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dokumente, setDokumente] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('offen'); // 'offen' | 'erledigt' | 'alle'
  const [dateEditTask, setDateEditTask] = useState(null);
  const [replyTask, setReplyTask] = useState(null);
  const [replyDok, setReplyDok] = useState(null);
  const [viewDok, setViewDok] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { router.push('/'); return; }
      setUser(data.user);
      loadTasks(data.user.id);
    });
  }, []);

  async function loadTasks(userId) {
    setLoading(true);
    // Load documents with their tasks (aufgaben stored in dokumente.aufgaben JSONB)
    const { data: docs } = await supabase
      .from('dokumente')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!docs) { setLoading(false); return; }

    const docsById = {};
    const allTasks = [];

    docs.forEach(dok => {
      docsById[dok.id] = dok;
      const aufgaben = Array.isArray(dok.aufgaben) ? dok.aufgaben : [];
      aufgaben.forEach((t, i) => {
        allTasks.push({
          _id: `${dok.id}_${i}`,
          dokument_id: dok.id,
          dringlichkeit: dok.dringlichkeit || 'niedrig',
          erledigt: t.erledigt || false,
          beschreibung: t.beschreibung || t.text || t,
          faelligkeitsdatum: t.faelligkeitsdatum || t.datum || dok.faelligkeitsdatum || null,
          empfehlung: t.empfehlung || null,
          antwort_erforderlich: t.antwort_erforderlich || false,
          empfaenger: dok.absender || '',
          _dokIndex: i,
        });
      });

      // Also check for top-level antwort_erforderlich on the document
      if (dok.antwort_erforderlich && aufgaben.length === 0) {
        allTasks.push({
          _id: `${dok.id}_reply`,
          dokument_id: dok.id,
          dringlichkeit: dok.dringlichkeit || 'hoch',
          erledigt: false,
          beschreibung: `Antwort an ${dok.absender || 'Absender'} erforderlich`,
          faelligkeitsdatum: dok.faelligkeitsdatum || null,
          antwort_erforderlich: true,
          empfaenger: dok.absender || '',
          _dokIndex: -1,
        });
      }
    });

    // Sort by urgency rank, then by date
    allTasks.sort((a, b) => {
      const rankA = (URGENCY[a.dringlichkeit] || URGENCY['niedrig']).rank;
      const rankB = (URGENCY[b.dringlichkeit] || URGENCY['niedrig']).rank;
      if (rankA !== rankB) return rankA - rankB;
      const dA = parseDate(a.faelligkeitsdatum);
      const dB = parseDate(b.faelligkeitsdatum);
      if (dA && dB) return dA - dB;
      if (dA) return -1;
      if (dB) return 1;
      return 0;
    });

    setTasks(allTasks);
    setDokumente(docsById);
    setLoading(false);
  }

  async function toggleTask(task) {
    const dok = dokumente[task.dokument_id];
    if (!dok) return;
    const aufgaben = Array.isArray(dok.aufgaben) ? [...dok.aufgaben] : [];
    if (task._dokIndex >= 0 && aufgaben[task._dokIndex]) {
      aufgaben[task._dokIndex] = { ...aufgaben[task._dokIndex], erledigt: !task.erledigt };
      await supabase.from('dokumente').update({ aufgaben }).eq('id', dok.id);
    }
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, erledigt: !t.erledigt } : t));
  }

  async function saveDateForTask(task, dateStr) {
    const dok = dokumente[task.dokument_id];
    if (!dok) return;
    const aufgaben = Array.isArray(dok.aufgaben) ? [...dok.aufgaben] : [];
    if (task._dokIndex >= 0 && aufgaben[task._dokIndex]) {
      aufgaben[task._dokIndex] = { ...aufgaben[task._dokIndex], faelligkeitsdatum: dateStr };
      await supabase.from('dokumente').update({ aufgaben }).eq('id', dok.id);
    } else {
      // top-level date on document
      await supabase.from('dokumente').update({ faelligkeitsdatum: dateStr }).eq('id', dok.id);
    }
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, faelligkeitsdatum: dateStr } : t));
    setDateEditTask(null);
  }

  const visibleTasks = tasks.filter(t => {
    if (filter === 'offen') return !t.erledigt;
    if (filter === 'erledigt') return t.erledigt;
    return true;
  });

  // Group by urgency for open tasks
  const grouped = {};
  if (filter === 'offen' || filter === 'alle') {
    visibleTasks.forEach(t => {
      const key = t.dringlichkeit || 'niedrig';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
  }

  const urgencyOrder = ['ueberfaellig', 'hoch', 'mittel', 'niedrig', 'ignorieren'];
  const openCount = tasks.filter(t => !t.erledigt).length;
  const urgentCount = tasks.filter(t => !t.erledigt && ['ueberfaellig','hoch'].includes(t.dringlichkeit)).length;

  return (
    <>
      <Head>
        <title>Aufgaben – Postklar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={{
        minHeight:'100dvh',background:'#F8F9FA',fontFamily:'Figtree, system-ui, sans-serif',
        paddingBottom: 80,
      }}>

        {/* Header */}
        <div style={{
          position:'sticky',top:0,zIndex:40,background:'#1F3A52',
          padding:'12px 16px',
          paddingTop:'calc(12px + env(safe-area-inset-top))',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <span style={{fontWeight:700,color:'#fff',fontSize:18,letterSpacing:'-0.02em'}}>Postklar</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {urgentCount > 0 && (
              <span style={{
                background:'#EF4444',color:'#fff',borderRadius:'50%',
                width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:12,fontWeight:700,
              }}>{urgentCount}</span>
            )}
            <button onClick={() => user && loadTasks(user.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
              <Icon d={icons.refresh} size={20} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{
          background:'#fff',borderBottom:'1px solid #E5E7EB',
          padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <div>
            <span style={{fontSize:24,fontWeight:800,color:'#111'}}>{openCount}</span>
            <span style={{fontSize:14,color:'#6B7280',marginLeft:6}}>offen</span>
            {urgentCount > 0 && (
              <span style={{
                marginLeft:10,fontSize:12,fontWeight:700,color:'#C2410C',
                background:'#FFF7ED',padding:'2px 10px',borderRadius:20,
              }}>
                {urgentCount} dringend
              </span>
            )}
          </div>
          {/* Filter pills */}
          <div style={{display:'flex',gap:4}}>
            {['offen','erledigt','alle'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:'4px 10px',borderRadius:20,border:'1px solid',fontSize:12,fontWeight:500,
                cursor:'pointer',fontFamily:'inherit',
                background: filter===f ? '#1F3A52' : '#fff',
                color: filter===f ? '#fff' : '#6B7280',
                borderColor: filter===f ? '#1F3A52' : '#E5E7EB',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{padding:'16px 16px 0'}}>
          {loading ? (
            <div style={{textAlign:'center',paddingTop:60,color:'#9CA3AF'}}>Lädt…</div>
          ) : visibleTasks.length === 0 ? (
            <div style={{
              textAlign:'center',paddingTop:60,color:'#9CA3AF',
            }}>
              <Icon d={icons.checkCircle} size={48} color="#D1FAE5" />
              <p style={{marginTop:12,fontSize:15,fontWeight:600,color:'#374151'}}>Keine offenen Aufgaben</p>
              <p style={{fontSize:13,color:'#9CA3AF'}}>Neue Dokumente scannen, um Aufgaben zu erhalten.</p>
            </div>
          ) : filter === 'erledigt' ? (
            visibleTasks.map(t => (
              <TaskCard key={t._id} task={t} dokument={dokumente[t.dokument_id]}
                onToggle={toggleTask} onDateEdit={setDateEditTask}
                onReply={(task, dok) => { setReplyTask(task); setReplyDok(dok); }}
                onViewDoc={setViewDok}
              />
            ))
          ) : (
            // Grouped by urgency
            urgencyOrder.map(urg => {
              const group = grouped[urg];
              if (!group || group.length === 0) return null;
              const cfg = URGENCY[urg];
              return (
                <div key={urg} style={{marginBottom:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{
                      width:8,height:8,borderRadius:'50%',background:cfg.dot,flexShrink:0,
                    }}/>
                    <span style={{fontSize:11,fontWeight:800,color:cfg.color,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                      {cfg.label}
                    </span>
                    <span style={{fontSize:11,color:'#9CA3AF'}}>{group.length} offen</span>
                  </div>
                  {group.map(t => (
                    <TaskCard key={t._id} task={t} dokument={dokumente[t.dokument_id]}
                      onToggle={toggleTask} onDateEdit={setDateEditTask}
                      onReply={(task, dok) => { setReplyTask(task); setReplyDok(dok); }}
                      onViewDoc={setViewDok}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <BottomNav active="aufgaben" />

      {/* Modals */}
      {dateEditTask && (
        <DateEditModal task={dateEditTask} onSave={saveDateForTask} onClose={() => setDateEditTask(null)} />
      )}
      {replyTask && (
        <ReplyModal task={replyTask} dokument={replyDok} onClose={() => { setReplyTask(null); setReplyDok(null); }} />
      )}
      {viewDok && <DocModal dok={viewDok} onClose={() => setViewDok(null)} />}
    </>
  );
}
