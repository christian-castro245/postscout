import { useState, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SectionList,
  RefreshControl, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import { useDocs, Dokument, Todo } from '../../hooks/useDocs'
import { Colors, FontFamily, Spacing, Radius, DRING, TODO_STATUS } from '../../constants/theme'
import { formatDate, daysUntil } from '../../lib/dateUtils'

type FilterStatus = 'alle' | 'offen' | 'erledigt'

interface FlatTodo {
  dok: Dokument
  todo: Todo
  idx: number
}

const STATUS_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'alle',     label: 'Alle' },
  { key: 'offen',    label: 'Offen' },
  { key: 'erledigt', label: 'Erledigt' },
]

export default function AufgabenScreen() {
  const { session } = useAuth()
  const { docs, loading, load, updateTodoStatus } = useDocs(session?.user.id)
  const [refreshing, setRefreshing]   = useState(false)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('offen')
  const { width } = useWindowDimensions()
  const hPad = Math.max(Spacing.lg, (width - 720) / 2)

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const flatTodos: FlatTodo[] = useMemo(() => {
    const result: FlatTodo[] = []
    docs.forEach(dok => {
      ;(dok.todos || []).forEach((todo, idx) => {
        const matchStatus =
          statusFilter === 'alle' ? true :
          statusFilter === 'erledigt' ? todo.status === 'erledigt' :
          todo.status !== 'erledigt'
        if (matchStatus) result.push({ dok, todo, idx })
      })
    })
    return result
  }, [docs, statusFilter])

  // Gruppiert nach Dringlichkeit (absteigend)
  const DRING_ORDER = ['ueberfaellig', 'hoch', 'mittel', 'niedrig', 'ignorieren']
  const sections = useMemo(() => {
    const groups: Record<string, FlatTodo[]> = {}
    flatTodos.forEach(item => {
      const key = DRING_ORDER.includes(item.todo.dringlichkeit) ? item.todo.dringlichkeit : 'niedrig'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return DRING_ORDER
      .filter(k => groups[k]?.length)
      .map(k => ({ title: k, data: groups[k] }))
  }, [flatTodos])

  if (!session) return null

  return (
    <View style={S.root}>
      {/* Status-Tabs */}
      <View style={[S.tabRow, { paddingHorizontal: hPad }]}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[S.tab, statusFilter === tab.key && S.tabActive]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[S.tabLabel, statusFilter === tab.key && S.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !docs.length
        ? <ActivityIndicator color={Colors.petrol} style={{ marginTop: 60 }} />
        : (
          <SectionList
            sections={sections}
            keyExtractor={(item, i) => `${item.dok.id}-${item.idx}-${i}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.petrol} />}
            contentContainerStyle={[S.listContent, { paddingHorizontal: hPad }]}
            stickySectionHeadersEnabled={false}
            SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderSectionHeader={({ section }) => {
              const d = DRING[section.title as keyof typeof DRING]
              return (
                <View style={S.sectionHeader}>
                  <View style={[S.sectionDot, { backgroundColor: d?.dot }]} />
                  <Text style={S.sectionTitle}>{d?.label || section.title}</Text>
                  <Text style={S.sectionCount}>{section.data.length}</Text>
                </View>
              )
            }}
            renderItem={({ item }) => (
              <TodoCard
                item={item}
                onStatusChange={() => {
                  const next = TODO_STATUS[item.todo.status as keyof typeof TODO_STATUS]?.next || 'erledigt'
                  updateTodoStatus(item.dok.id, item.idx, next)
                }}
              />
            )}
            ListEmptyComponent={<EmptyState filter={statusFilter} />}
          />
        )
      }
    </View>
  )
}

function TodoCard({ item, onStatusChange }: { item: FlatTodo; onStatusChange: () => void }) {
  const { dok, todo } = item
  const days = daysUntil(todo.frist)
  const erledigt = todo.status === 'erledigt'
  const statusDef = TODO_STATUS[todo.status as keyof typeof TODO_STATUS]

  return (
    <TouchableOpacity
      style={[S.card, erledigt && S.cardDone]}
      onPress={() => router.push(`/dokument/${dok.id}`)}
      activeOpacity={0.8}
    >
      <TouchableOpacity
        style={S.checkBtn}
        onPress={onStatusChange}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={[S.checkCircle, erledigt && S.checkCircleDone]}>
          {erledigt && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={S.cardBody}>
        <Text style={[S.taskText, erledigt && S.taskTextDone]} numberOfLines={2}>{todo.aufgabe}</Text>
        <Text style={S.docName} numberOfLines={1}>{dok.absender || dok.titel || dok.dateiname}</Text>

        <View style={S.metaRow}>
          {todo.frist && (
            <View style={[S.fristChip, days != null && days < 0 ? S.fristOverdue : days === 0 ? S.fristToday : S.fristFuture]}>
              <Ionicons name="calendar-outline" size={10} color="currentColor" />
              <Text style={S.fristText}>
                {days != null && days < 0
                  ? `${Math.abs(days)}T überfällig`
                  : days === 0 ? 'Heute'
                  : formatDate(todo.frist)}
              </Text>
            </View>
          )}
          {!erledigt && statusDef && statusDef.label !== 'Offen' && (
            <View style={[S.statusChip, { backgroundColor: statusDef.bg }]}>
              <Text style={[S.statusText, { color: statusDef.color }]}>{statusDef.label}</Text>
            </View>
          )}
          {todo.betrag != null && (
            <View style={S.betragChip}>
              <Text style={S.betragText}>{todo.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function EmptyState({ filter }: { filter: FilterStatus }) {
  return (
    <View style={S.empty}>
      <Text style={S.emptyIcon}>{filter === 'erledigt' ? '✅' : '🎉'}</Text>
      <Text style={S.emptyTitle}>{filter === 'erledigt' ? 'Noch nichts erledigt' : 'Keine offenen Aufgaben'}</Text>
      <Text style={S.emptyText}>
        {filter === 'erledigt'
          ? 'Erledigte Aufgaben erscheinen hier.'
          : 'Alle Aufgaben erledigt – oder noch keine Briefe gescannt.'}
      </Text>
    </View>
  )
}

const S = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  tabRow:         { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.hairline, paddingVertical: 8, gap: 4 },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: Radius.md },
  tabActive:      { backgroundColor: Colors.petrolTint },
  tabLabel:       { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  tabLabelActive: { fontFamily: FontFamily.bodyBold, color: Colors.petrol },
  listContent:    { paddingTop: 12, paddingBottom: 40 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 8 },
  sectionDot:     { width: 8, height: 8, borderRadius: 4 },
  sectionTitle:   { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: Colors.faint, flex: 1 },
  sectionCount:   { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.faint },
  card:           { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, flexDirection: 'row', alignItems: 'flex-start', padding: 13, gap: 10 },
  cardDone:       { opacity: 0.6 },
  checkBtn:       { paddingTop: 2 },
  checkCircle:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkCircleDone:{ borderColor: Colors.done, backgroundColor: Colors.done },
  cardBody:       { flex: 1 },
  taskText:       { fontFamily: FontFamily.body, fontSize: 14, color: Colors.ink, lineHeight: 20, marginBottom: 4 },
  taskTextDone:   { textDecorationLine: 'line-through', color: Colors.muted },
  docName:        { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: Colors.muted, marginBottom: 6 },
  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fristChip:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  fristOverdue:   { backgroundColor: Colors.urgentBg },
  fristToday:     { backgroundColor: Colors.highBg },
  fristFuture:    { backgroundColor: Colors.mediumBg },
  fristText:      { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.medium },
  statusChip:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  statusText:     { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  betragChip:     { backgroundColor: Colors.subtle, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  betragText:     { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.ink },
  empty:          { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon:      { fontSize: 40, marginBottom: 14 },
  emptyTitle:     { fontFamily: FontFamily.bodyBold, fontSize: 17, color: Colors.ink, marginBottom: 8 },
  emptyText:      { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 21 },
})
