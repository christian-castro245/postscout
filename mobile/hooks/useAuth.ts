import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  vorname: string
  nachname: string
  anrede: string
}

export function useAuth() {
  const [session, setSession]   = useState<Session | null>(null)
  const [loading, setLoading]   = useState(true)
  const [profile, setProfile]   = useState<Profile | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('vorname,nachname,anrede')
      .eq('id', uid)
      .single()
    if (data) setProfile(data)
  }

  function greeting(): string {
    if (!profile && session) return session.user.email?.split('@')[0] || 'Hallo'
    if (!profile) return 'Hallo'
    const { anrede, vorname, nachname } = profile
    if (anrede === 'Herr' || anrede === 'Frau') {
      return `Guten Tag, ${anrede} ${nachname || vorname}`
    }
    return `Guten Tag, ${vorname || session?.user?.email?.split('@')[0] || ''}`
  }

  async function signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email: string, password: string) {
    return supabase.auth.signUp({ email, password })
  }

  async function resetPassword(email: string) {
    return supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://postscout-beige.vercel.app',
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return { session, loading, profile, greeting, signIn, signUp, signOut, resetPassword }
}
