import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Switch, useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Colors, FontFamily, Spacing, Radius } from '../constants/theme'

type Tab = 'profil' | 'freigaben'

interface FullProfile {
  vorname: string
  nachname: string
  anrede: string
  strasse: string
  plz: string
  ort: string
  geburtsdatum: string
  telefon: string
  steuer_id: string
  bank_name: string
  iban: string
  bic: string
}

const ANREDEN = ['du', 'Herr', 'Frau']

export default function ProfilScreen() {
  const { session, signOut } = useAuth()
  const [tab, setTab]         = useState<Tab>('profil')
  const [profile, setProfile] = useState<FullProfile | null>(null)
  const [busy, setBusy]       = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved]     = useState(false)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteBusy, setInviteBusy]       = useState(false)
  const { width } = useWindowDimensions()
  const hPad = Math.max(Spacing.lg, (width - 680) / 2)

  useEffect(() => {
    if (session) {
      loadProfile()
      loadFamily()
    }
  }, [session])

  async function loadProfile() {
    if (!session) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (data) setProfile(data)
    else setProfile({
      vorname: '', nachname: '', anrede: 'du',
      strasse: '', plz: '', ort: '', geburtsdatum: '',
      telefon: '', steuer_id: '', bank_name: '', iban: '', bic: '',
    })
    setLoading(false)
  }

  async function loadFamily() {
    if (!session) return
    const { data } = await supabase
      .from('familien_zugang')
      .select('*')
      .eq('inhaber_id', session.user.id)
      .eq('aktiv', true)
    setFamilyMembers(data || [])
  }

  async function saveProfile() {
    if (!session || !profile) return
    setBusy(true)
    await supabase.from('profiles').upsert({ id: session.user.id, ...profile })
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function sendInvite() {
    if (!session || !inviteEmail.trim()) return
    setInviteBusy(true)
    try {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await supabase.from('familien_zugang').insert({
        inhaber_id: session.user.id,
        mitglied_email: inviteEmail.trim(),
        berechtigung: 'lesen',
        aktiv: false,
        invite_token: token,
      })
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://postscout-beige.vercel.app'}/api/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim(), token }),
      })
      if (res.ok) {
        Alert.alert('Einladung gesendet', `${inviteEmail.trim()} wurde eingeladen.`)
        setInviteEmail('')
        loadFamily()
      } else {
        Alert.alert('Fehler', 'Einladung konnte nicht gesendet werden.')
      }
    } catch {
      Alert.alert('Fehler', 'Netzwerkfehler beim Senden der Einladung.')
    }
    setInviteBusy(false)
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/')
  }

  if (!session) return null

  return (
    <ScrollView style={S.root} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Tabs */}
      <View style={[S.tabRow, { paddingHorizontal: hPad }]}>
        <TouchableOpacity style={[S.tab, tab === 'profil' && S.tabActive]} onPress={() => setTab('profil')}>
          <Text style={[S.tabLabel, tab === 'profil' && S.tabLabelActive]}>Mein Profil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === 'freigaben' && S.tabActive]} onPress={() => setTab('freigaben')}>
          <Text style={[S.tabLabel, tab === 'freigaben' && S.tabLabelActive]}>Freigaben</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={Colors.petrol} style={{ marginTop: 60 }} />
        : tab === 'profil'
          ? <ProfilTab
              profile={profile}
              setProfile={setProfile}
              busy={busy}
              saved={saved}
              onSave={saveProfile}
              email={session.user.email || ''}
              hPad={hPad}
            />
          : <FreigabenTab
              members={familyMembers}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteBusy={inviteBusy}
              onInvite={sendInvite}
              onRevoke={async (id: string) => {
                await supabase.from('familien_zugang').update({ aktiv: false }).eq('id', id)
                loadFamily()
              }}
              hPad={hPad}
            />
      }

      {/* Abmelden */}
      <View style={[S.section, { paddingHorizontal: hPad }]}>
        <TouchableOpacity style={S.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.urgent} />
          <Text style={S.signOutLabel}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function ProfilTab({
  profile, setProfile, busy, saved, onSave, email, hPad,
}: {
  profile: FullProfile | null
  setProfile: (p: FullProfile) => void
  busy: boolean
  saved: boolean
  onSave: () => void
  email: string
  hPad: number
}) {
  if (!profile) return null

  function field(key: keyof FullProfile) {
    return {
      value: profile![key],
      onChangeText: (v: string) => setProfile({ ...profile!, [key]: v }),
    }
  }

  return (
    <View style={[S.section, { paddingHorizontal: hPad }]}>
      {/* Anrede */}
      <Text style={S.fieldLabel}>Anrede</Text>
      <View style={S.anredeRow}>
        {ANREDEN.map(a => (
          <TouchableOpacity
            key={a}
            style={[S.anredeChip, profile.anrede === a && S.anredeChipActive]}
            onPress={() => setProfile({ ...profile, anrede: a })}
          >
            <Text style={[S.anredeText, profile.anrede === a && S.anredeTextActive]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldGroup>
        <Field label="Vorname" {...field('vorname')}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Field label="Nachname" {...field('nachname')}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
        />
      </FieldGroup>

      <Field label="E-Mail (nicht änderbar)" value={email} editable={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <FieldGroup>
        <Field label="Telefon" {...field('telefon')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <Field label="Geburtsdatum" {...field('geburtsdatum')}
          placeholder="TT.MM.JJJJ"
          keyboardType="numbers-and-punctuation"
          textContentType="birthdate"
        />
      </FieldGroup>

      <Field label="Straße und Hausnummer" {...field('strasse')}
        autoCapitalize="words"
        autoComplete="street-address"
        textContentType="streetAddressLine1"
      />
      <FieldGroup>
        <Field label="PLZ" {...field('plz')}
          keyboardType="numeric"
          autoComplete="postal-code"
          textContentType="postalCode"
          flex={0.35}
        />
        <Field label="Ort" {...field('ort')}
          autoCapitalize="words"
          autoComplete="address-level2"
          textContentType="addressCity"
          flex={0.65}
        />
      </FieldGroup>

      <Text style={[S.fieldLabel, { marginTop: 16 }]}>Bankverbindung</Text>
      <Field label="Bank" {...field('bank_name')} autoCapitalize="words" />
      <Field label="IBAN" {...field('iban')} autoCapitalize="characters" autoComplete="off" textContentType="none" />
      <Field label="BIC" {...field('bic')} autoCapitalize="characters" autoComplete="off" textContentType="none" />
      <Field label="Steuer-ID" {...field('steuer_id')} autoComplete="off" textContentType="none" />

      <TouchableOpacity style={[S.saveBtn, saved && S.saveBtnDone]} onPress={onSave} disabled={busy}>
        {busy
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
              <Text style={S.saveBtnLabel}>{saved ? 'Gespeichert' : 'Speichern'}</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  )
}

function FreigabenTab({
  members, inviteEmail, setInviteEmail, inviteBusy, onInvite, onRevoke, hPad,
}: {
  members: any[]
  inviteEmail: string
  setInviteEmail: (e: string) => void
  inviteBusy: boolean
  onInvite: () => void
  onRevoke: (id: string) => void
  hPad: number
}) {
  return (
    <View style={[S.section, { paddingHorizontal: hPad }]}>
      <Text style={S.infoText}>
        Laden Sie Familienmitglieder ein, auf Ihre Briefe zuzugreifen. Sie entscheiden, welche Berechtigung sie erhalten.
      </Text>

      {/* Einladen */}
      <View style={S.inviteRow}>
        <TextInput
          style={S.inviteInput}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="E-Mail-Adresse einladen"
          placeholderTextColor={Colors.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TouchableOpacity style={S.inviteBtn} onPress={onInvite} disabled={inviteBusy || !inviteEmail.trim()}>
          {inviteBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.inviteBtnLabel}>Einladen</Text>}
        </TouchableOpacity>
      </View>

      {/* Mitgliedsliste */}
      {members.length > 0
        ? members.map(m => (
            <View key={m.id} style={S.memberCard}>
              <View style={S.memberInfo}>
                <Text style={S.memberEmail}>{m.mitglied_email}</Text>
                <Text style={S.memberBerechtigung}>{m.berechtigung} · {m.aktiv ? 'Aktiv' : 'Ausstehend'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Zugang widerrufen', `${m.mitglied_email} den Zugang entziehen?`, [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Widerrufen', style: 'destructive', onPress: () => onRevoke(m.id) },
                ])}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle-outline" size={22} color={Colors.urgent} />
              </TouchableOpacity>
            </View>
          ))
        : <Text style={S.emptyText}>Noch keine Freigaben erteilt.</Text>
      }
    </View>
  )
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <View style={S.fieldGroup}>{children}</View>
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, autoComplete, textContentType, editable, flex,
}: {
  label: string
  value: string
  onChangeText?: (v: string) => void
  placeholder?: string
  keyboardType?: any
  autoCapitalize?: any
  autoComplete?: any
  textContentType?: any
  editable?: boolean
  flex?: number
}) {
  return (
    <View style={[S.fieldWrap, flex !== undefined && { flex }]}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TextInput
        style={[S.input, editable === false && S.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        editable={editable !== false}
      />
    </View>
  )
}

const S = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  tabRow:            { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.hairline, paddingVertical: 8, paddingTop: 14, gap: 4 },
  tab:               { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md },
  tabActive:         { backgroundColor: Colors.petrolTint },
  tabLabel:          { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  tabLabelActive:    { fontFamily: FontFamily.bodyBold, color: Colors.petrol },
  section:           { paddingTop: Spacing.lg, paddingBottom: 8 },
  anredeRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  anredeChip:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.subtle, borderWidth: 1, borderColor: Colors.border },
  anredeChipActive:  { backgroundColor: Colors.petrolTint, borderColor: Colors.petrol },
  anredeText:        { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  anredeTextActive:  { fontFamily: FontFamily.bodyBold, color: Colors.petrol },
  fieldGroup:        { flexDirection: 'row', gap: 10 },
  fieldWrap:         { flex: 1, marginBottom: 12 },
  fieldLabel:        { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: Colors.faint, marginBottom: 5 },
  input:             { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 13, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: 15, color: Colors.ink },
  inputDisabled:     { backgroundColor: Colors.subtle, color: Colors.muted },
  saveBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.petrol, borderRadius: Radius.lg, paddingVertical: 14, marginTop: 16 },
  saveBtnDone:       { backgroundColor: Colors.done },
  saveBtnLabel:      { fontFamily: FontFamily.bodyBold, fontSize: 15, color: '#fff' },
  infoText:          { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, lineHeight: 21, marginBottom: 16 },
  inviteRow:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inviteInput:       { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 13, paddingVertical: 11, fontFamily: FontFamily.body, fontSize: 15, color: Colors.ink },
  inviteBtn:         { backgroundColor: Colors.petrol, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  inviteBtnLabel:    { fontFamily: FontFamily.bodyBold, fontSize: 14, color: '#fff' },
  memberCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 13, marginBottom: 8 },
  memberInfo:        { flex: 1 },
  memberEmail:       { fontFamily: FontFamily.bodySemi, fontSize: 14, color: Colors.ink },
  memberBerechtigung:{ fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.muted, marginTop: 2 },
  emptyText:         { fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint, textAlign: 'center', paddingVertical: 20 },
  signOutBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.urgentBg, borderRadius: Radius.lg, paddingVertical: 14, justifyContent: 'center', marginTop: 8 },
  signOutLabel:      { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.urgent },
})
