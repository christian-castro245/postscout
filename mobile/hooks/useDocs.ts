import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Aufgabe {
  beschreibung: string
  faelligkeitsdatum: string | null
  erledigt: boolean
  typ: string
  betrag: number | null
  empfaenger: string | null
  iban: string | null
  bic: string | null
  verwendungszweck: string | null
  belegstelle: string | null
}

export interface Todo {
  aufgabe: string
  frist: string | null
  dringlichkeit: string
  status: string
  erledigt: boolean
  typ: string
  betrag: number | null
  empfaenger: string | null
  iban: string | null
  bic: string | null
  verwendungszweck: string | null
  belegstelle: string | null
  kontext: string | null
}

export interface Notiz {
  text: string
  autor: string
  erstellt_am: string
}

export interface Dokument {
  id: string
  user_id: string
  dateiname: string
  titel: string | null
  absender: string | null
  absender_email: string | null
  kategorie: string | null
  dringlichkeit: string
  zusammenfassung: string | null
  faelligkeitsdatum: string | null
  antwort_erforderlich: boolean
  analysiert: boolean
  bild_url: string | null
  bild_urls: string[] | null
  quelle: string | null
  aufgaben: Aufgabe[]
  todos: Todo[]
  notizen: Notiz[]
  erstellt_am: string
  jahr: number | null
}

export function useDocs(userId: string | null | undefined) {
  const [docs, setDocs]       = useState<Dokument[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (uid?: string) => {
    const id = uid || userId
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('dokumente')
      .select('*')
      .eq('user_id', id)
      .order('erstellt_am', { ascending: false })
    if (!error && data) setDocs(data)
    setLoading(false)
  }, [userId])

  async function updateTodoStatus(dokId: string, todoIdx: number, nextStatus: string) {
    const dok = docs.find(d => d.id === dokId)
    if (!dok) return
    const todos = [...(dok.todos || [])]
    todos[todoIdx] = { ...todos[todoIdx], status: nextStatus, erledigt: nextStatus === 'erledigt' }
    await supabase.from('dokumente').update({ todos }).eq('id', dokId)
    setDocs(prev => prev.map(d => d.id === dokId ? { ...d, todos } : d))
  }

  async function deleteDoc(dokId: string) {
    const dok = docs.find(d => d.id === dokId)
    if (!dok) return

    if (dok.bild_url) {
      const path = dok.bild_url.split('/storage/v1/object/public/dokumente/')[1]
      if (path) await supabase.storage.from('dokumente').remove([path])
    }
    if (dok.bild_urls && dok.bild_urls.length > 1) {
      const paths = dok.bild_urls
        .slice(1)
        .map(u => u.split('/storage/v1/object/public/dokumente/')[1])
        .filter(Boolean) as string[]
      if (paths.length) await supabase.storage.from('dokumente').remove(paths)
    }

    await supabase.from('dokumente').delete().eq('id', dokId)
    setDocs(prev => prev.filter(d => d.id !== dokId))
  }

  return { docs, loading, load, setDocs, updateTodoStatus, deleteDoc }
}
