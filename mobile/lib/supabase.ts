import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? ''
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabaseConfigured = supabaseUrl !== '' && supabaseAnon !== ''

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnon || 'placeholder-anon-key',
  {
    auth: {
      storage:            AsyncStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
  }
)
