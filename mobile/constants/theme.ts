// Postklar Design-System — exakt aus dem Brandbook
export const Colors = {
  petrol:        '#0F3D47',
  petrolPressed: '#0A2E37',
  petrolTint:    '#E2EEF1',
  petrolTintBd:  '#B5D4DC',

  amber:         '#E8973C',
  amberLight:    '#FBF0DC',

  bg:            '#FBF8F3',
  surface:       '#FFFFFF',
  subtle:        '#F5F2EC',

  ink:           '#1A1712',
  muted:         '#5A7078',
  faint:         '#8A9BA1',

  border:        '#E0DDD3',
  hairline:      '#EFEDE6',

  urgent:        '#C4462F',
  urgentBg:      '#FBEAE7',
  high:          '#C2410C',
  highBg:        '#FBF0E8',
  medium:        '#8A5A12',
  mediumBg:      '#FBF4E6',
  done:          '#2E7D63',
  doneBg:        '#E6F0EC',
  ignore:        '#7C786E',
  ignoreBg:      '#F4F2EC',
} as const

export const FontFamily = {
  // Geladen via expo-google-fonts
  heading:      'Literata_700Bold',
  headingSemi:  'Literata_600SemiBold',
  body:         'Inter_500Medium',
  bodyBold:     'Inter_700Bold',
  bodyRegular:  'Inter_400Regular',
  bodySemi:     'Inter_600SemiBold',
} as const

export const Spacing = {
  xs:  4,
  sm:  8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl:40,
} as const

export const Radius = {
  sm:  8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

export const DRING = {
  ueberfaellig: { label: 'Überfällig',    color: Colors.urgent,  bg: Colors.urgentBg,  dot: '#EF4444' },
  hoch:         { label: 'Dringend',      color: Colors.high,    bg: Colors.highBg,    dot: '#F97316' },
  mittel:       { label: 'Mittelfristig', color: Colors.medium,  bg: Colors.mediumBg,  dot: Colors.medium },
  niedrig:      { label: 'Zur Kenntnis',  color: Colors.done,    bg: Colors.doneBg,    dot: '#34A853' },
  ignorieren:   { label: 'Werbung',       color: Colors.ignore,  bg: Colors.ignoreBg,  dot: Colors.faint },
} as const

export const TODO_STATUS = {
  offen:          { label: 'Offen',             next: 'in_bearbeitung', color: '#C8C4B8', bg: 'transparent' },
  in_bearbeitung: { label: 'In Bearbeitung',    next: 'wartet',         color: Colors.medium,  bg: Colors.mediumBg  },
  wartet:         { label: 'Warte auf Antwort', next: 'erledigt',       color: Colors.petrol,  bg: Colors.petrolTint },
  erledigt:       { label: 'Erledigt',          next: 'offen',          color: Colors.done,    bg: Colors.doneBg    },
} as const
