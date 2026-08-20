import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily } from '../../constants/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.petrol,
        tabBarInactiveTintColor: '#B0ADA4',
        tabBarStyle: {
          backgroundColor: 'rgba(251,248,243,0.97)',
          borderTopColor:  Colors.hairline,
          paddingBottom:   Platform.OS === 'ios' ? 20 : 8,
          paddingTop:      8,
          height:          Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.body,
          fontSize:   10,
        },
        headerStyle:      { backgroundColor: Colors.petrol },
        headerTintColor:  '#fff',
        headerTitleStyle: { fontFamily: FontFamily.bodyBold, fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Start',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          headerTitle: 'Postklar',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scannen',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" size={size} color={color} />,
          headerTitle: 'Brief scannen',
        }}
      />
      <Tabs.Screen
        name="archiv"
        options={{
          title: 'Archiv',
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color} />,
          headerTitle: 'Archiv',
        }}
      />
      <Tabs.Screen
        name="aufgaben"
        options={{
          title: 'Aufgaben',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />,
          headerTitle: 'Alle Aufgaben',
        }}
      />
    </Tabs>
  )
}
