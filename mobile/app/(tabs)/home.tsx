import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Animated, Modal,
  Pressable, Platform,
} from 'react-native'
import { router, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import { useDocs, Dokument, Todo } from '../../hooks/useDocs'
import { Colors, FontFamily, Spacing, Radius, DRING, TODO_STATUS } from '../../constants/theme'
import { formatDate, daysUntil } from '../../lib/dateUtils'
import { useFadeIn } from '../../hooks/useFadeIn'

export default function HomeScreen() {
  const { session, greeting, signOut } = useAuth()
  const { docs, loading, load, updateTodoStatus } = useDocs(session?.user.id)
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fade = useFadeIn()
  const navigation = useNavigation()

  const openMenu = useCallback(() => setMenuOpen(true), [])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={openMenu}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      ),
    })
  }, [navigation, openMenu])

  useEffect(() => {
    if (session) load()
  }, [session])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const dringendeTodos: { dok: Dokument; todo: Todo; idx: number }[] = []
  docs.forEach(dok => {
    ;(dok.todos || []).forEach((todo, idx) => {
      if (todo.status !== 'erledigt' && (todo.dringlichkeit === 'ueberfaellig' || todo.dringlichkeit === 'hoch')) {
        dringendeTodos.push({ dok, todo, idx })
      }
    })
  })

  const offeneTodos = docs.reduce((n, d) => n + (d.todos || []).filter(t => t.status !== 'erledigt').length, 0)
  const dringendeCount = dringendeTodos.length

  if (!session) return null

  return (
    <>
      <Animated.ScrollView
        style={[S.root, { opacity: fade.opacity, transform: [{ translateY: fade.translateY }] }]}
        contentContainerStyle={S.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.petrol} />}
      >
        {/* Hero */}
        <View style={S.hero}>
          <Text style={S.heroGreeting}>{greeting()}</Text>
          <View style={S.statsRow}>
            <View style={S.stat}>
              <Text style={S.statNum}>{docs.length}</Text>
              <Text style={S.statLabel}>Briefe</Text>
            </View>
            <View style={S.statDiv} />
            <View style={S.stat}>
              <Text style={S.statNum}>{offeneTodos}</Text>
              <Text style={S.statLabel}>Offene Aufgaben</Text>
            </View>
            <View style={S.statDiv} />
            <View style={S.stat}>
              <Text style={[S.statNum, dringendeCount > 0 && { color: '#FFB347' }]}>{dringendeCount}</Text>
              <Text style={S.statLabel}>Dringend</Text>
            </View>
          </View>
        </View>

        {/* Scan CTA */}
        <TouchableOpacity style={S.scanBtn} onPress={() => router.push('/(tabs)/scan')} activeOpacity={0.85}>
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={S.scanBtnLabel}>Brief scannen oder hochladen</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Dringende Todos */}
        {dringendeTodos.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Jetzt handeln</Text>
            {dringendeTodos.slice(0, 5).map(({ dok, todo, idx }) => {
              const d = DRING[todo.dringlichkeit as keyof typeof DRING] || DRING.niedrig
              const days = daysUntil(todo.frist)
              return (
                <TouchableOpacity
                  key={`${dok.id}-${idx}`}
                  style={S.todoCard}
                  onPress={() => router.push(`/dokument/${dok.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={[S.todoDot, { backgroundColor: d.dot }]} />
                  <View style={S.todoBody}>
                    <Text style={S.todoText} numberOfLines={2}>{todo.aufgabe}</Text>
                    <Text style={S.todoMeta}>{dok.absender || dok.titel || 'Unbekannt'}</Text>
                    {todo.frist && (
                      <View style={[S.fristChip, { backgroundColor: d.bg }]}>
                        <Text style={[S.fristText, { color: d.color }]}>
                          {days != null && days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'Heute fällig' : `Fällig ${formatDate(todo.frist)}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={S.checkBtn}
                    onPress={() => updateTodoStatus(dok.id, idx, TODO_STATUS[todo.status as keyof typeof TODO_STATUS]?.next || 'erledigt')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <View style={[S.checkCircle, todo.status === 'erledigt' && S.checkCircleDone]}>
                      {todo.status === 'erledigt' && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Neueste Dokumente */}
        {docs.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Zuletzt hinzugefügt</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/archiv')}>
                <Text style={S.sectionLink}>Alle</Text>
              </TouchableOpacity>
            </View>
            {docs.slice(0, 4).map(dok => (
              <DocRow key={dok.id} dok={dok} />
            ))}
          </View>
        )}

        {docs.length === 0 && !loading && (
          <View style={S.emptyState}>
            <Text style={S.emptyIcon}>📬</Text>
            <Text style={S.emptyTitle}>Noch keine Briefe</Text>
            <Text style={S.emptyText}>Scannen Sie Ihren ersten Brief, um loszulegen.</Text>
          </View>
        )}

        {loading && docs.length === 0 && (
          <View style={S.loadingWrap}>
            <ActivityIndicator color={Colors.petrol} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Hamburger Bottom-Sheet */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={M.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={M.sheet} onPress={e => e.stopPropagation()}>
            <View style={M.handle} />

            <MenuItem
              icon="person-outline"
              label="Profil"
              sub="Name, Adresse, Bankdaten"
              onPress={() => { setMenuOpen(false); router.push('/profil') }}
            />
            <MenuItem
              icon="people-outline"
              label="Familienfreigabe"
              sub="Mitglieder einladen & verwalten"
              onPress={() => { setMenuOpen(false); router.push('/profil') }}
            />
            <MenuItem
              icon="camera-outline"
              label="Nur-Scan-Modus"
              sub="Brief scannen ohne Konto"
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/scan') }}
            />
            <MenuItem
              icon="share-outline"
              label="Export"
              sub="Daten exportieren"
              onPress={() => { setMenuOpen(false) }}
            />

            <View style={M.divider} />

            <MenuItem
              icon="log-out-outline"
              label="Abmelden"
              destructive
              onPress={() => {
                setMenuOpen(false)
                signOut()
              }}
            />

            <View style={{ height: Platform.OS === 'ios' ? 32 : 16 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function MenuItem({
  icon, label, sub, destructive, onPress,
}: {
  icon: string
  label: string
  sub?: string
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={M.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[M.iconWrap, destructive && M.iconWrapRed]}>
        <Ionicons name={icon as any} size={20} color={destructive ? Colors.urgent : Colors.petrol} />
      </View>
      <View style={M.itemText}>
        <Text style={[M.itemLabel, destructive && { color: Colors.urgent }]}>{label}</Text>
        {sub && <Text style={M.itemSub}>{sub}</Text>}
      </View>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={Colors.faint} />}
    </TouchableOpacity>
  )
}

function DocRow({ dok }: { dok: Dokument }) {
  const d = DRING[dok.dringlichkeit as keyof typeof DRING] || DRING.niedrig
  const offene = (dok.todos || []).filter(t => t.status !== 'erledigt').length
  return (
    <TouchableOpacity style={S.docCard} onPress={() => router.push(`/dokument/${dok.id}`)} activeOpacity={0.8}>
      <View style={[S.dringDot, { backgroundColor: d.dot }]} />
      <View style={S.docBody}>
        <Text style={S.docTitle} numberOfLines={1}>{dok.titel || dok.absender || dok.dateiname}</Text>
        <Text style={S.docMeta} numberOfLines={1}>{dok.absender || dok.zusammenfassung || ''}</Text>
      </View>
      <View style={S.docRight}>
        {offene > 0 && (
          <View style={S.badge}>
            <Text style={S.badgeText}>{offene}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.faint} />
      </View>
    </TouchableOpacity>
  )
}

const M = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  divider:     { height: 1, backgroundColor: Colors.hairline, marginVertical: 8 },
  item:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  iconWrap:    { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.petrolTint, alignItems: 'center', justifyContent: 'center' },
  iconWrapRed: { backgroundColor: Colors.urgentBg },
  itemText:    { flex: 1 },
  itemLabel:   { fontFamily: FontFamily.bodySemi, fontSize: 16, color: Colors.ink },
  itemSub:     { fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.muted, marginTop: 1 },
})

const S = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  content:        { paddingBottom: 32 },
  hero:           { backgroundColor: Colors.petrol, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 20 },
  heroGreeting:   { fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  statsRow:       { flexDirection: 'row', alignItems: 'center' },
  stat:           { flex: 1, alignItems: 'center' },
  statNum:        { fontFamily: FontFamily.heading, fontSize: 36, color: '#fff', lineHeight: 40 },
  statLabel:      { fontFamily: FontFamily.bodyRegular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDiv:        { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },
  scanBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: Colors.petrol, borderRadius: 18, padding: 16, height: 58 },
  scanBtnLabel:   { fontFamily: FontFamily.bodySemi, fontSize: 15, color: '#fff', flex: 1 },
  section:        { marginHorizontal: 20, marginBottom: 24 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:   { fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.faint },
  sectionLink:    { fontFamily: FontFamily.bodySemi, fontSize: 13, color: Colors.petrol },
  todoCard:       { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  todoDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  todoBody:       { flex: 1 },
  todoText:       { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 20, marginBottom: 4 },
  todoMeta:       { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: Colors.muted, marginBottom: 6 },
  fristChip:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  fristText:      { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  checkBtn:       { padding: 4 },
  checkCircle:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone:{ borderColor: Colors.done, backgroundColor: Colors.done },
  docCard:        { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dringDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  docBody:        { flex: 1 },
  docTitle:       { fontFamily: FontFamily.bodySemi, fontSize: 15, color: Colors.ink, marginBottom: 2 },
  docMeta:        { fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.muted },
  docRight:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge:          { backgroundColor: Colors.amber, borderRadius: Radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:      { fontFamily: FontFamily.bodyBold, fontSize: 11, color: '#fff' },
  emptyState:     { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon:      { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontFamily: FontFamily.bodyBold, fontSize: 18, color: Colors.ink, marginBottom: 8 },
  emptyText:      { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  loadingWrap:    { paddingVertical: 60, alignItems: 'center' },
})
