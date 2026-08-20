import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  TextInput, ActivityIndicator, Image, Modal, KeyboardAvoidingView,
  Platform, useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../hooks/useAuth'
import { useDocs, Dokument, Todo } from '../../hooks/useDocs'
import { erklaerMir, generateReply, addNotiz } from '../../lib/api'
import { Colors, FontFamily, Spacing, Radius, DRING, TODO_STATUS } from '../../constants/theme'
import { formatDate, formatDateLong, daysUntil } from '../../lib/dateUtils'

type AiMode = 'erklaer' | 'antwort' | null

export default function DokumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const { docs, loading, load, updateTodoStatus, deleteDoc } = useDocs(session?.user.id)
  const [dok, setDok] = useState<Dokument | null>(null)
  const [aiMode, setAiMode] = useState<AiMode>(null)
  const [aiFrage, setAiFrage] = useState('')
  const [aiAntwort, setAiAntwort] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [notizText, setNotizText] = useState('')
  const [notizBusy, setNotizBusy] = useState(false)
  const [notizOpen, setNotizOpen] = useState(false)
  const [fotoIdx, setFotoIdx] = useState(0)
  const { width } = useWindowDimensions()
  const hPad = Math.max(Spacing.lg, (width - 720) / 2)
  const notizRef = useRef<TextInput>(null)

  useEffect(() => {
    if (session && !docs.length) load()
  }, [session])

  useEffect(() => {
    const found = docs.find(d => d.id === id)
    if (found) setDok(found)
  }, [docs, id])

  async function handleDelete() {
    Alert.alert('Brief löschen', 'Dieser Brief wird unwiderruflich gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          if (!id) return
          await deleteDoc(id)
          router.back()
        },
      },
    ])
  }

  async function handleErklaer() {
    if (!session || !id || !aiFrage.trim()) return
    setAiBusy(true)
    const res = await erklaerMir(aiFrage, id, session)
    setAiBusy(false)
    if ('antwort' in res) {
      setAiAntwort(res.antwort)
    } else {
      Alert.alert('Fehler', res.error)
    }
  }

  async function handleAntwort() {
    if (!session || !id) return
    setAiBusy(true)
    const res = await generateReply(id, session)
    setAiBusy(false)
    if ('antwort' in res) {
      setAiAntwort(res.antwort)
    } else {
      Alert.alert('Fehler', res.error)
    }
  }

  async function handleAddNotiz() {
    if (!session || !id || !notizText.trim()) return
    setNotizBusy(true)
    const res = await addNotiz(id, notizText.trim(), session)
    setNotizBusy(false)
    if ('error' in res) {
      Alert.alert('Fehler', res.error)
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setNotizText('')
      setNotizOpen(false)
      load()
    }
  }

  if (!session || loading && !dok) {
    return (
      <View style={S.center}>
        <ActivityIndicator color={Colors.petrol} size="large" />
      </View>
    )
  }

  if (!dok) {
    return (
      <View style={S.center}>
        <Text style={S.notFound}>Dokument nicht gefunden.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={S.backLink}>Zurück</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const d = DRING[dok.dringlichkeit as keyof typeof DRING] || DRING.niedrig
  const allPhotos = [dok.bild_url, ...(dok.bild_urls || [])].filter(Boolean) as string[]
  const offeneTodos = (dok.todos || []).filter(t => t.status !== 'erledigt')

  return (
    <>
      <ScrollView style={S.root} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Kopf-Karte */}
        <View style={[S.headerCard, { paddingHorizontal: hPad }]}>
          <View style={S.headerTop}>
            <View style={[S.dringBadge, { backgroundColor: d.bg }]}>
              <View style={[S.dringDot, { backgroundColor: d.dot }]} />
              <Text style={[S.dringLabel, { color: d.color }]}>{d.label}</Text>
            </View>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={20} color={Colors.urgent} />
            </TouchableOpacity>
          </View>

          <Text style={S.title}>{dok.titel || dok.absender || dok.dateiname}</Text>

          {dok.absender && dok.titel && (
            <Text style={S.absender}>{dok.absender}</Text>
          )}

          <View style={S.metaRow}>
            <MetaChip icon="calendar-outline" label={formatDateLong(dok.erstellt_am)} />
            {dok.faelligkeitsdatum && (
              <MetaChip icon="time-outline" label={`Frist: ${formatDate(dok.faelligkeitsdatum)}`} urgent />
            )}
            {dok.kategorie && (
              <MetaChip icon="folder-outline" label={dok.kategorie} />
            )}
            {dok.quelle && (
              <MetaChip icon={dok.quelle === 'email' ? 'mail-outline' : 'camera-outline'} label={dok.quelle === 'email' ? 'E-Mail' : 'Scan'} />
            )}
          </View>

          {dok.zusammenfassung && (
            <Text style={S.summary}>{dok.zusammenfassung}</Text>
          )}
        </View>

        {/* Fotos */}
        {allPhotos.length > 0 && (
          <View style={[S.section, { paddingHorizontal: hPad }]}>
            <Text style={S.sectionTitle}>Seiten</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.fotoStrip}>
              {allPhotos.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => setFotoIdx(i)} style={[S.fotoThumbWrap, fotoIdx === i && S.fotoThumbActive]}>
                  <Image source={{ uri: url }} style={S.fotoThumb} resizeMode="cover" />
                  <Text style={S.fotoNum}>{i + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {allPhotos[fotoIdx] && (
              <Image source={{ uri: allPhotos[fotoIdx] }} style={[S.fotoMain, { width: '100%', maxWidth: 720 }]} resizeMode="contain" />
            )}
          </View>
        )}

        {/* Todos */}
        {(dok.todos || []).length > 0 && (
          <View style={[S.section, { paddingHorizontal: hPad }]}>
            <Text style={S.sectionTitle}>Aufgaben</Text>
            {dok.todos.map((todo, idx) => (
              <TodoRow
                key={idx}
                todo={todo}
                idx={idx}
                onStatusChange={() => {
                  const next = TODO_STATUS[todo.status as keyof typeof TODO_STATUS]?.next || 'erledigt'
                  updateTodoStatus(dok.id, idx, next)
                }}
              />
            ))}
          </View>
        )}

        {/* AI-Aktionen */}
        <View style={[S.section, { paddingHorizontal: hPad }]}>
          <Text style={S.sectionTitle}>Aktionen</Text>
          <View style={S.actionRow}>
            <ActionBtn
              icon="help-circle-outline"
              label="Erkläre mir"
              onPress={() => { setAiMode('erklaer'); setAiAntwort(''); setAiFrage('') }}
            />
            <ActionBtn
              icon="document-text-outline"
              label="Antwort erstellen"
              onPress={() => { setAiMode('antwort'); setAiAntwort(''); handleAntwort() }}
            />
            <ActionBtn
              icon="create-outline"
              label="Notiz hinzufügen"
              onPress={() => setNotizOpen(true)}
            />
          </View>

          {/* Erkläre-mir Flow */}
          {aiMode === 'erklaer' && (
            <View style={S.aiBox}>
              <TextInput
                style={S.aiInput}
                value={aiFrage}
                onChangeText={setAiFrage}
                placeholder="Was möchten Sie wissen?"
                placeholderTextColor={Colors.faint}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleErklaer}
                autoCapitalize="sentences"
                autoCorrect
                textContentType="none"
              />
              <TouchableOpacity style={S.aiBtn} onPress={handleErklaer} disabled={aiBusy || !aiFrage.trim()}>
                {aiBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.aiBtnLabel}>Fragen</Text>}
              </TouchableOpacity>
              {aiAntwort ? <Text style={S.aiAntwort}>{aiAntwort}</Text> : null}
            </View>
          )}

          {/* Antwort-Flow */}
          {aiMode === 'antwort' && (
            <View style={S.aiBox}>
              {aiBusy
                ? <ActivityIndicator color={Colors.petrol} style={{ marginVertical: 20 }} />
                : aiAntwort
                  ? <Text style={S.aiAntwort}>{aiAntwort}</Text>
                  : null
              }
            </View>
          )}
        </View>

        {/* Notizen */}
        {(dok.notizen || []).length > 0 && (
          <View style={[S.section, { paddingHorizontal: hPad }]}>
            <Text style={S.sectionTitle}>Notizen</Text>
            {dok.notizen.map((n, i) => (
              <View key={i} style={S.notizCard}>
                <Text style={S.notizText}>{n.text}</Text>
                <Text style={S.notizMeta}>{n.autor} · {formatDate(n.erstellt_am)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Notiz-Modal */}
      <Modal visible={notizOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNotizOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={S.modalRoot}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Notiz hinzufügen</Text>
              <TouchableOpacity onPress={() => setNotizOpen(false)}>
                <Ionicons name="close" size={24} color={Colors.ink} />
              </TouchableOpacity>
            </View>
            <TextInput
              ref={notizRef}
              style={S.notizInput}
              value={notizText}
              onChangeText={setNotizText}
              placeholder="Ihre Notiz…"
              placeholderTextColor={Colors.faint}
              multiline
              autoFocus
              autoCapitalize="sentences"
              autoCorrect
              textContentType="none"
            />
            <TouchableOpacity style={[S.aiBtn, { margin: Spacing.lg }]} onPress={handleAddNotiz} disabled={notizBusy || !notizText.trim()}>
              {notizBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.aiBtnLabel}>Speichern</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

function MetaChip({ icon, label, urgent }: { icon: any; label: string; urgent?: boolean }) {
  return (
    <View style={[S.metaChip, urgent && S.metaChipUrgent]}>
      <Ionicons name={icon} size={12} color={urgent ? Colors.urgent : Colors.petrol} />
      <Text style={[S.metaChipText, urgent && { color: Colors.urgent }]}>{label}</Text>
    </View>
  )
}

function ActionBtn({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={S.actionBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={22} color={Colors.petrol} />
      <Text style={S.actionBtnLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function TodoRow({ todo, idx, onStatusChange }: { todo: Todo; idx: number; onStatusChange: () => void }) {
  const erledigt = todo.status === 'erledigt'
  const days = daysUntil(todo.frist)
  const d = DRING[todo.dringlichkeit as keyof typeof DRING] || DRING.niedrig

  return (
    <View style={[S.todoCard, erledigt && { opacity: 0.55 }]}>
      <TouchableOpacity
        onPress={onStatusChange}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[S.checkCircle, erledigt && S.checkDone]}>
          {erledigt && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[S.todoText, erledigt && S.todoTextDone]}>{todo.aufgabe}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {todo.frist && (
            <View style={[S.fristChip, { backgroundColor: d.bg }]}>
              <Text style={[S.fristText, { color: d.color }]}>
                {days != null && days < 0 ? `${Math.abs(days)}T überfällig` : days === 0 ? 'Heute' : formatDate(todo.frist)}
              </Text>
            </View>
          )}
          {todo.betrag != null && (
            <View style={S.betragChip}>
              <Text style={S.betragText}>{todo.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
            </View>
          )}
          {todo.empfaenger && (
            <View style={S.betragChip}>
              <Text style={S.betragText}>{todo.empfaenger}</Text>
            </View>
          )}
        </View>
        {todo.iban && <Text style={S.ibanText}>IBAN: {todo.iban}</Text>}
        {todo.verwendungszweck && <Text style={S.ibanText}>VWZ: {todo.verwendungszweck}</Text>}
      </View>
    </View>
  )
}

const S = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notFound:         { fontFamily: FontFamily.body, fontSize: 16, color: Colors.muted, marginBottom: 16 },
  backLink:         { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.petrol },
  headerCard:       { backgroundColor: Colors.surface, paddingTop: Spacing.lg, paddingBottom: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.hairline, marginBottom: 12 },
  headerTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dringBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  dringDot:         { width: 7, height: 7, borderRadius: 3.5 },
  dringLabel:       { fontFamily: FontFamily.bodyBold, fontSize: 12 },
  title:            { fontFamily: FontFamily.heading, fontSize: 22, color: Colors.ink, lineHeight: 28, marginBottom: 4 },
  absender:         { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginBottom: 10 },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  metaChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.petrolTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  metaChipUrgent:   { backgroundColor: Colors.urgentBg },
  metaChipText:     { fontFamily: FontFamily.bodySemi, fontSize: 12, color: Colors.petrol },
  summary:          { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 22 },
  section:          { marginBottom: 20 },
  sectionTitle:     { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: Colors.faint, marginBottom: 10 },
  fotoStrip:        { flexDirection: 'row', marginBottom: 10 },
  fotoThumbWrap:    { marginRight: 8, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  fotoThumbActive:  { borderColor: Colors.petrol },
  fotoThumb:        { width: 64, height: 80, backgroundColor: Colors.subtle },
  fotoNum:          { position: 'absolute', bottom: 4, right: 4, fontFamily: FontFamily.bodyBold, fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  fotoMain:         { height: 320, borderRadius: Radius.lg, backgroundColor: Colors.subtle, marginTop: 4 },
  todoCard:         { flexDirection: 'row', gap: 10, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 13, marginBottom: 8 },
  checkCircle:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone:        { borderColor: Colors.done, backgroundColor: Colors.done },
  todoText:         { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 20 },
  todoTextDone:     { textDecorationLine: 'line-through', color: Colors.muted },
  fristChip:        { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  fristText:        { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  betragChip:       { backgroundColor: Colors.subtle, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  betragText:       { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.ink },
  ibanText:         { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: Colors.muted, marginTop: 3 },
  actionRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn:        { flex: 1, minWidth: 100, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.petrolTintBd, padding: 14, alignItems: 'center', gap: 6 },
  actionBtnLabel:   { fontFamily: FontFamily.bodySemi, fontSize: 12, color: Colors.petrol, textAlign: 'center' },
  aiBox:            { marginTop: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 14 },
  aiInput:          { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, minHeight: 60, textAlignVertical: 'top', marginBottom: 10 },
  aiBtn:            { backgroundColor: Colors.petrol, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center' },
  aiBtnLabel:       { fontFamily: FontFamily.bodyBold, fontSize: 15, color: '#fff' },
  aiAntwort:        { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 22, marginTop: 14 },
  notizCard:        { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 13, marginBottom: 8 },
  notizText:        { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 21, marginBottom: 6 },
  notizMeta:        { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: Colors.faint },
  modalRoot:        { flex: 1, backgroundColor: Colors.bg },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.hairline },
  modalTitle:       { fontFamily: FontFamily.bodyBold, fontSize: 17, color: Colors.ink },
  notizInput:       { flex: 1, margin: Spacing.lg, fontFamily: FontFamily.body, fontSize: 15, color: Colors.ink, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 14 },
})
