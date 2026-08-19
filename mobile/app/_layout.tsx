import { useEffect } from 'react'
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
