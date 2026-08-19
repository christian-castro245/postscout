import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import { useDocs, Dokument } from '../../hooks/useDocs'
import { Colors, FontFamily, Spacing, Radius, DRING } from '../../constants/theme'
import { formatDate } from '../../lib/dateUtils'

const KATEGORIEN = ['Alle', 'Behörde', 'Versicherung', 'Bank', 'Vermieter', 'Arzt', 'Arbeit', 'Sonstige']
const DRING_FILTER = ['Alle', 'ueberfaellig', 'hoch', 'mittel', 'niedrig', 'ignorieren'] as const

export default function ArchivScreen() {
  const { session } = useAuth()
  const { docs, loading, load } = useDocs(session?.user.id)
  const [refreshing, setRefreshing] = useState(false)
  const [suche, setSuche] = useState('')
  const [katFilter, setKatFilter] = useState('Alle')
  const [dringFilter, setDringFilter] = useState('Alle')
  const { width } = useWindowDimensions()

  useEffect(() => { if (session) load() }, [session])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const gefiltert = useMemo(() => {
    let result = docs
    if (suche.trim()) {
      const q = suche.toLowerCase()
      result = result.filter(d =>
        (d.titel || '').toLowerCase().includes(q) ||
        (d.absender || '').toLowerCase().includes(q) ||
        (d.zusammenfassung || '').toLowerCase().includes(q)
      )
    }
    if (katFilter !== 'Alle') result = result.filter(d => d.kategorie === katFilter)
    if (dringFilter !== 'Alle') result = result.filter(d => d.dringlichkeit === dringFilter)
    return result
  }, [docs, suche, katFilter, dringFilter])

  if (!session) return null

  return (
    <View style={S.root}>
      {/* Suchleiste */}
      <View style={[S.searchRow, { paddingHorizontal: Math.max(Spacing.lg, (width - 720) / 2) }]}>
        <Ionicons name="search" size={18} color={Colors.faint} style={S.searchIcon} />
        <TextInput
          style={S.searchInput}
          value={suche}
          onChangeText={setSuche}
          placeholder="Suchen…"
          placeholderTextColor={Colors.faint}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {suche.length > 0 && (
          <TouchableOpacity onPress={() => setSuche('')}>
            <Ionicons name="close-circle" size={18} color={Colors.faint} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter-Chips Dringlichkeit */}
      <FlatList
        horizontal
        data={DRING_FILTER}
        keyExtractor={i => i}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[S.chipStrip, { paddingHorizontal: Math.max(Spacing.lg, (width - 720) / 2) }]}
        renderItem={({ item }) => {
          const active = dringFilter === item
          const d = item !== 'Alle' ? DRING[item as keyof typeof DRING] : null
          return (
            <TouchableOpacity
              style={[S.chip, active && { backgroundColor: d?.bg || Colors.petrolTint, borderColor: d?.color || Colors.petrol }]}
              onPress={() => setDringFilter(item)}
            >
              {d && <View style={[S.chipDot, { backgroundColor: d.dot }]} />}
              <Text style={[S.chipText, active && { color: d?.color || Colors.petrol, fontFamily: FontFamily.bodyBold }]}>
                {item === 'Alle' ? 'Alle' : d?.label}
              </Text>
            </TouchableOpacity>
          )
        }}
      />

      {/* Ergebnis-Liste */}
      <FlatList
        data={gefiltert}
        keyExtractor={d => d.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.petrol} />}
        contentContainerStyle={[S.listContent, { paddingHorizontal: Math.max(Spacing.lg, (width - 720) / 2) }]}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={Colors.petrol} style={{ marginTop: 60 }} />
            : <EmptyState suche={suche} />
        }
        renderItem={({ item }) => <ArchivCard dok={item} />}
      />
    </View>
  )
}

function ArchivCard({ dok }: { dok: Dokument }) {
  const d = DRING[dok.dringlichkeit as keyof typeof DRING] || DRING.niedrig
  const offene = (dok.todos || []).filter(t => t.status !== 'erledigt').length
  return (
    <TouchableOpacity style={S.card} onPress={() => router.push(`/dokument/${dok.id}`)} activeOpacity={0.8}>
      <View style={[S.dringStripe, { backgroundColor: d.dot }]} />
      <View style={S.cardBody}>
        <View style={S.cardTop}>
          <Text style={S.cardTitle} numberOfLines={1}>{dok.titel || dok.absender || dok.dateiname}</Text>
          <Text style={S.cardDate}>{formatDate(dok.erstellt_am)}</Text>
        </View>
        {dok.absender && dok.titel && (
          <Text style={S.cardSub} numberOfLines={1}>{dok.absender}</Text>
        )}
        {dok.zusammenfassung && (
          <Text style={S.cardSummary} numberOfLines={2}>{dok.zusammenfassung}</Text>
        )}
        <View style={S.cardFooter}>
          {dok.kategorie && (
            <View style={S.katChip}>
              <Text style={S.katText}>{dok.kategorie}</Text>
            </View>
          )}
          {offene > 0 && (
            <View style={S.todoChip}>
              <Text style={S.todoChipText}>{offene} {offene === 1 ? 'Aufgabe' : 'Aufgaben'}</Text>
            </View>
          )}
          {dok.faelligkeitsdatum && (
            <View style={S.fristChip}>
              <Ionicons name="calendar-outline" size={11} color={Colors.medium} />
              <Text style={S.fristText}>{formatDate(dok.faelligkeitsdatum)}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.faint} />
    </TouchableOpacity>
  )
}

function EmptyState({ suche }: { suche: string }) {
  return (
    <View style={S.empty}>
      <Text style={S.emptyIcon}>{suche ? '🔍' : '📂'}</Text>
      <Text style={S.emptyTitle}>{suche ? 'Keine Treffer' : 'Noch keine Briefe'}</Text>
      <Text style={S.emptyText}>
        {suche ? `Für „${suche}" wurden keine Dokumente gefunden.` : 'Scannen Sie Ihren ersten Brief unter „Scannen".'}
      </Text>
    </View>
  )
}

const S = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  searchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.hairline, paddingVertical: 10 },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, fontFamily: FontFamily.body, fontSize: 16, color: Colors.ink, paddingVertical: 0 },
  chipStrip:    { paddingVertical: 12, gap: 8, flexDirection: 'row' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.subtle, borderWidth: 1, borderColor: Colors.border },
  chipDot:      { width: 6, height: 6, borderRadius: 3 },
  chipText:     { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  listContent:  { paddingTop: 4, paddingBottom: 32 },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  dringStripe:  { width: 4, alignSelf: 'stretch' },
  cardBody:     { flex: 1, padding: 13 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  cardTitle:    { fontFamily: FontFamily.bodySemi, fontSize: 15, color: Colors.ink, flex: 1 },
  cardDate:     { fontFamily: FontFamily.bodyRegular, fontSize: 12, color: Colors.faint, flexShrink: 0 },
  cardSub:      { fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.muted, marginBottom: 4 },
  cardSummary:  { fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 8 },
  cardFooter:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  katChip:      { backgroundColor: Colors.petrolTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  katText:      { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.petrol },
  todoChip:     { backgroundColor: Colors.amberLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  todoChipText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.amber },
  fristChip:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.mediumBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  fristText:    { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.medium },
  empty:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon:    { fontSize: 40, marginBottom: 14 },
  emptyTitle:   { fontFamily: FontFamily.bodyBold, fontSize: 17, color: Colors.ink, marginBottom: 8 },
  emptyText:    { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 21 },
})
