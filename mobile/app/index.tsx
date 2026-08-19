import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, ScrollView, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../hooks/useAuth'
import { Colors, FontFamily, Spacing, Radius } from '../constants/theme'

export default function AuthScreen() {
  const { session, loading, signIn, signUp } = useAuth()
  const [mode, setMode]       = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState<{ text: string; err: boolean } | null>(null)

  useEffect(() => {
    if (!loading && session) router.replace('/(tabs)/home')
  }, [session, loading])

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color={Colors.petrol} />
      </View>
    )
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      setMsg({ text: 'Bitte E-Mail und Passwort eingeben.', err: true })
      return
    }
    setBusy(true); setMsg(null)
    const { error } = mode === 'login'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password)

    if (error) {
      setMsg({ text: error.message, err: true })
    } else if (mode === 'register') {
      setMsg({ text: 'Bestätigungs-E-Mail gesendet. Bitte prüfen Sie Ihr Postfach.', err: false })
    }
    setBusy(false)
  }

  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={S.hero}>
          <View style={S.logoMark}>
            <Text style={S.logoIcon}>✉</Text>
          </View>
          <Text style={S.heroTitle}>Postklar</Text>
          <Text style={S.heroSub}>Post, die man versteht.{'\n'}Fristen, die niemand verpasst.</Text>
        </View>

        {/* Form */}
        <View style={S.sheet}>
          <View style={S.tabRow}>
            <TouchableOpacity
              style={[S.tab, mode === 'login' && S.tabActive]}
              onPress={() => { setMode('login'); setMsg(null) }}
            >
              <Text style={[S.tabLabel, mode === 'login' && S.tabLabelActive]}>Anmelden</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.tab, mode === 'register' && S.tabActive]}
              onPress={() => { setMode('register'); setMsg(null) }}
            >
              <Text style={[S.tabLabel, mode === 'register' && S.tabLabelActive]}>Registrieren</Text>
            </TouchableOpacity>
          </View>

          <View style={S.fieldWrap}>
            <Text style={S.label}>E-Mail-Adresse</Text>
            <TextInput
              style={S.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholderTextColor={Colors.faint}
              placeholder="ihre@email.de"
            />
          </View>

          <View style={S.fieldWrap}>
            <Text style={S.label}>Passwort</Text>
            <TextInput
              style={S.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholderTextColor={Colors.faint}
              placeholder="••••••••"
            />
          </View>

          {msg && (
            <View style={[S.msgBox, msg.err ? S.msgErr : S.msgOk]}>
              <Text style={[S.msgText, { color: msg.err ? Colors.urgent : Colors.done }]}>{msg.text}</Text>
            </View>
          )}

          <TouchableOpacity style={S.btn} onPress={handleAuth} disabled={busy}>
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={S.btnLabel}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={S.dsgvo}>
          Ihre Daten werden ausschließlich auf Servern in Deutschland verarbeitet.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const S = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.petrol },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  scroll:     { flexGrow: 1 },
  hero:       { paddingTop: 80, paddingBottom: 48, paddingHorizontal: 28, alignItems: 'center' },
  logoMark:   { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoIcon:   { fontSize: 30 },
  heroTitle:  { fontFamily: FontFamily.heading, fontSize: 36, color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroSub:    { fontFamily: FontFamily.body, fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24 },
  sheet:      { backgroundColor: Colors.surface, borderRadius: 24, margin: 20, padding: 20 },
  tabRow:     { flexDirection: 'row', backgroundColor: Colors.subtle, borderRadius: Radius.md, padding: 3, marginBottom: 20 },
  tab:        { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:  { backgroundColor: Colors.surface },
  tabLabel:   { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  tabLabelActive: { color: Colors.ink, fontFamily: FontFamily.bodyBold },
  fieldWrap:  { marginBottom: 14 },
  label:      { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: Colors.faint, marginBottom: 6 },
  input:      { backgroundColor: Colors.subtle, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 13, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: 16, color: Colors.ink },
  msgBox:     { borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  msgErr:     { backgroundColor: Colors.urgentBg },
  msgOk:      { backgroundColor: Colors.doneBg },
  msgText:    { fontFamily: FontFamily.body, fontSize: 14 },
  btn:        { backgroundColor: Colors.petrol, borderRadius: Radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnLabel:   { fontFamily: FontFamily.bodyBold, fontSize: 16, color: '#fff' },
  dsgvo:      { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', paddingHorizontal: 28, paddingVertical: 20 },
})
