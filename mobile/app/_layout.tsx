import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import {
  Literata_400Regular,
  Literata_600SemiBold,
  Literata_700Bold,
} from '@expo-google-fonts/literata'
import { Colors } from '../constants/theme'
import { supabaseConfigured } from '../lib/supabase'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Literata_400Regular,
    Literata_600SemiBold,
    Literata_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  if (!supabaseConfigured) {
    return (
      <View style={cfgStyles.root}>
        <Text style={cfgStyles.title}>Konfigurationsfehler</Text>
        <Text style={cfgStyles.body}>
          EXPO_PUBLIC_SUPABASE_URL und{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY{'\n'}fehlen in den EAS-Umgebungsvariablen.
        </Text>
        <Text style={cfgStyles.hint}>
          Lösung:{'\n'}eas env:set --scope project{'\n'}danach neu bauen und einreichen.
        </Text>
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.petrol} />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.petrol },
          headerTintColor:  '#fff',
          headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle:     { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="index"         options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"        options={{ headerShown: false }} />
        <Stack.Screen name="dokument/[id]" options={{ title: 'Brief', headerBackTitle: 'Zurück' }} />
        <Stack.Screen name="profil"        options={{ title: 'Profil', presentation: 'modal' }} />
        <Stack.Screen name="scan-modal"    options={{ title: 'Brief scannen', presentation: 'fullScreenModal', headerShown: false }} />
      </Stack>
    </>
  )
}

const cfgStyles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#B3402C', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  body:  { color: 'rgba(255,255,255,0.9)', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  hint:  { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 20, fontFamily: 'monospace' },
})
