import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, ScrollView, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../hooks/useAuth'
import { Colors, FontFamily, Spacing, Radius } from '../constants/theme'

export default function AuthScreen() {
  const { session, loading, signIn, signUp } = useAuth()
  const [mode, setMode]         = useState<'login' | 'register'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState<{ text: string; err: boolean } | null>(null)

  const heroOpacity  = useRef(new Animated.Value(0)).current
  const heroTranslate = useRef(new Animated.Value(24)).current
  const cardOpacity  = useRef(new Animated.Value(0)).current
  const cardTranslate = useRef(new Animated.Value(40)).current

  useEffect(() => {
    if (!loading && session) router.replace('/(tabs)/home')
  }, [session, loading])

  useEffect(() => {
    if (loading) return
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity,   { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(heroTranslate, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity,   { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(cardTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start()
  }, [loading])

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color={Colors.petrol} />
      </View>
    )
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8)                     return 'Mindestens 8 Zeichen erforderlich.'
    if (!/[A-Z]/.test(pw))                return 'Mindestens ein Großbuchstabe erforderlich.'
    if (!/[a-z]/.test(pw))                return 'Mindestens ein Kleinbuchstabe erforderlich.'
    if (!/[0-9]/.test(pw))                return 'Mindestens eine Ziffer erforderlich.'
    if (!/[^A-Za-z0-9]/.test(pw))         return 'Mindestens ein Sonderzeichen erforderlich (!@#$%…).'
    return null
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      setMsg({ text: 'Bitte E-Mail und Passwort eingeben.', err: true })
      return
    }
    if (mode === 'register') {
      const pwErr = validatePassword(password)
      if (pwErr) { setMsg({ text: pwErr, err: true }); return }
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
        <Animated.View
          style={[S.hero, { opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}
        >
          <View style={S.logoMark}>
            <Text style={S.logoIcon}>✉</Text>
          </View>
          <Text style={S.heroTitle}>Postklar</Text>
          <Text style={S.heroSub}>Post, die man versteht.{'\n'}Fristen, die niemand verpasst.</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          style={[S.sheet, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}
        >
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
              textContentType="emailAddress"
              returnKeyType="next"
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
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              returnKeyType="done"
              onSubmitEditing={handleAuth}
              placeholderTextColor={Colors.faint}
              placeholder="••••••••"
            />
            {mode === 'register' && password.length > 0 && (
              <PasswordStrength password={password} />
            )}
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
        </Animated.View>

        <Animated.Text style={[S.dsgvo, { opacity: cardOpacity }]}>
          Ihre Daten werden ausschließlich auf Servern in Deutschland verarbeitet.
        </Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const CHECKS = [
  { label: 'Mindestens 8 Zeichen',   test: (pw: string) => pw.length >= 8 },
  { label: 'Großbuchstabe (A–Z)',     test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Kleinbuchstabe (a–z)',    test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Ziffer (0–9)',            test: (pw: string) => /[0-9]/.test(pw) },
  { label: 'Sonderzeichen (!@#$…)',   test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

function PasswordStrength({ password }: { password: string }) {
  const passed = CHECKS.filter(c => c.test(password)).length
  const barColors = ['#B3402C', '#C2410C', '#8A5A12', '#2E7D46', '#1F3A52']
  return (
    <View style={P.wrap}>
      <View style={P.bars}>
        {CHECKS.map((_, i) => (
          <View key={i} style={[P.bar, { backgroundColor: i < passed ? barColors[passed - 1] : '#E0DDD3' }]} />
        ))}
      </View>
      <View style={P.checks}>
        {CHECKS.map(c => {
          const ok = c.test(password)
          return (
            <View key={c.label} style={P.checkRow}>
              <View style={[P.dot, { backgroundColor: ok ? '#2E7D46' : '#E0DDD3' }]} />
              <Text style={[P.checkLabel, ok && P.checkLabelOk]}>{c.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const P = StyleSheet.create({
  wrap:         { marginTop: 8 },
  bars:         { flexDirection: 'row', gap: 4, marginBottom: 8 },
  bar:          { flex: 1, height: 3, borderRadius: 2 },
  checks:       { gap: 4 },
  checkRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  checkLabel:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#9A968B' },
  checkLabelOk: { color: '#2E7D46' },
})

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
