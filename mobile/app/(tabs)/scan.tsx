import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Image, Platform,
} from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { analyzeDocument } from '../../lib/api'
import { Colors, FontFamily, Radius, Spacing } from '../../constants/theme'

// On-Device OCR ist mit Apple Vision möglich wenn nötig.
// Aktuell: Bilder direkt an die Analyse-API (Server in EU).
// aufGeraet = false bis Apple Vision integriert ist.
const AUF_GERAET = false

export default function ScanScreen() {
  const { session } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [photos, setPhotos]   = useState<string[]>([]) // base64 URIs
  const [analyzing, setAnalyzing] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [facing, setFacing]   = useState<CameraType>('back')
  const cameraRef = useRef<CameraView>(null)

  useEffect(() => {
    // Kamera nicht direkt öffnen — erst nach Tap
  }, [])

  async function takePhoto() {
    if (!cameraRef.current) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false, skipProcessing: false })
    if (!photo) return

    // Komprimieren auf max 1500px — reduziert Upload-Größe und API-Kosten
    const compressed = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1500 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    )
    if (compressed.base64) {
      setPhotos(prev => [...prev, compressed.base64!])
      setCameraActive(false)
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.9,
    })
    if (result.canceled) return

    const processed: string[] = []
    for (const asset of result.assets) {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1500 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      )
      if (compressed.base64) processed.push(compressed.base64)
    }
    setPhotos(prev => [...prev, ...processed].slice(0, 5))
  }

  async function analyse() {
    if (!session || !photos.length) return
    setAnalyzing(true)
    try {
      const result = await analyzeDocument(
        photos.map(b => ({ base64: b })),
        session
      )
      if ('error' in result || !result.ok) {
        Alert.alert('Fehler', (result as any).error || 'Analyse fehlgeschlagen')
        return
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPhotos([])
      router.push('/(tabs)/archiv')
    } catch (e: any) {
      Alert.alert('Fehler', e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  if (!session) return null

  // Kamera-Ansicht
  if (cameraActive) {
    if (!permission?.granted) {
      return (
        <View style={S.center}>
          <Text style={S.permText}>Kamera-Zugriff erforderlich</Text>
          <TouchableOpacity style={S.btn} onPress={requestPermission}>
            <Text style={S.btnLabel}>Zugriff erlauben</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing}>
          {/* Ecken-Marker */}
          <View style={S.corner} />
          <View style={[S.corner, { right: 20, left: undefined }]} />
          <View style={[S.corner, { bottom: 120, top: undefined }]} />
          <View style={[S.corner, { bottom: 120, top: undefined, right: 20, left: undefined }]} />

          {/* Controls */}
          <View style={S.camControls}>
            <TouchableOpacity style={S.camBtn} onPress={() => setCameraActive(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={S.shutterBtn} onPress={takePhoto} activeOpacity={0.8}>
              <View style={S.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={S.camBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={S.camHint}>
            <Text style={S.camHintText}>Halten Sie den Brief gerade und gut beleuchtet</Text>
          </View>
        </CameraView>
      </View>
    )
  }

  // Haupt-Scan-UI
  return (
    <ScrollView style={S.root} contentContainerStyle={S.content}>
      {/* Datenschutz-Hinweis */}
      {!AUF_GERAET && (
        <View style={S.privacyBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.petrol} />
          <Text style={S.privacyText}>
            Ihre Briefe werden auf EU-Servern (Frankfurt) analysiert — keine US-Cloud.
          </Text>
        </View>
      )}
      {AUF_GERAET && (
        <View style={[S.privacyBanner, { backgroundColor: Colors.doneBg }]}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.done} />
          <Text style={[S.privacyText, { color: Colors.done }]}>
            Ihr Brief verlässt Ihr Gerät nicht. Analyse erfolgt vollständig auf Ihrem iPhone.
          </Text>
        </View>
      )}

      {/* Fotos */}
      {photos.length > 0 && (
        <View style={S.photosSection}>
          <Text style={S.photosSectionTitle}>Seiten ({photos.length}/5)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.photoStrip}>
            {photos.map((b64, i) => (
              <View key={i} style={S.photoWrap}>
                <Image source={{ uri: `data:image/jpeg;base64,${b64}` }} style={S.photoThumb} />
                <TouchableOpacity
                  style={S.photoDelete}
                  onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={S.pageNum}>
                  <Text style={S.pageNumText}>{i + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Aufnahme-Buttons */}
      <View style={S.captureRow}>
        <TouchableOpacity style={S.captureBtn} onPress={() => {
          if (!permission?.granted) requestPermission().then(p => { if (p.granted) setCameraActive(true) })
          else setCameraActive(true)
        }}>
          <Ionicons name="camera" size={28} color={Colors.petrol} />
          <Text style={S.captureBtnLabel}>Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.captureBtn} onPress={pickFromGallery}>
          <Ionicons name="images" size={28} color={Colors.petrol} />
          <Text style={S.captureBtnLabel}>Fotos</Text>
        </TouchableOpacity>
      </View>

      {/* Hinweistext */}
      {photos.length === 0 && (
        <View style={S.hint}>
          <Text style={S.hintTitle}>So geht's</Text>
          <Text style={S.hintText}>📸  Brief flach hinlegen, gut beleuchten</Text>
          <Text style={S.hintText}>📄  Mehrere Seiten? Einfach nacheinander fotografieren</Text>
          <Text style={S.hintText}>✅  Postklar erkennt Fristen, Beträge und Aufgaben automatisch</Text>
        </View>
      )}

      {/* Analyse-Button */}
      {photos.length > 0 && (
        <TouchableOpacity style={S.analyseBtn} onPress={analyse} disabled={analyzing} activeOpacity={0.85}>
          {analyzing
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={S.analyseBtnLabel}>
                  {photos.length === 1 ? 'Brief analysieren' : `${photos.length} Seiten analysieren`}
                </Text>
              </>
          }
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const S = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  content:           { padding: Spacing.lg },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText:          { fontFamily: FontFamily.body, fontSize: 16, color: Colors.ink, marginBottom: 20, textAlign: 'center' },
  privacyBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.petrolTint, borderRadius: Radius.md, padding: 12, marginBottom: 20 },
  privacyText:       { fontFamily: FontFamily.body, fontSize: 13, color: Colors.petrol, flex: 1, lineHeight: 18 },
  photosSection:     { marginBottom: 20 },
  photosSectionTitle:{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.muted, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  photoStrip:        { flexDirection: 'row' },
  photoWrap:         { marginRight: 10, position: 'relative' },
  photoThumb:        { width: 100, height: 130, borderRadius: Radius.md, backgroundColor: Colors.subtle },
  photoDelete:       { position: 'absolute', top: -8, right: -8, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pageNum:           { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pageNumText:       { color: '#fff', fontSize: 11, fontFamily: FontFamily.bodyBold },
  captureRow:        { flexDirection: 'row', gap: 12, marginBottom: 24 },
  captureBtn:        { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: 24, alignItems: 'center', gap: 8 },
  captureBtnLabel:   { fontFamily: FontFamily.bodySemi, fontSize: 14, color: Colors.petrol },
  hint:              { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.hairline, padding: 20, marginBottom: 20 },
  hintTitle:         { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.ink, marginBottom: 12 },
  hintText:          { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, lineHeight: 22, marginBottom: 6 },
  analyseBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.petrol, borderRadius: Radius.xl, paddingVertical: 16, marginTop: 8 },
  analyseBtnLabel:   { fontFamily: FontFamily.bodyBold, fontSize: 16, color: '#fff' },
  btn:               { backgroundColor: Colors.petrol, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 24 },
  btnLabel:          { fontFamily: FontFamily.bodyBold, fontSize: 15, color: '#fff' },
  // Kamera
  corner:            { position: 'absolute', top: 60, left: 20, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderRadius: 4 },
  camControls:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 50, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  camBtn:            { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  shutterBtn:        { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)' },
  shutterInner:      { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  camHint:           { position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' },
  camHintText:       { fontFamily: FontFamily.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
})
