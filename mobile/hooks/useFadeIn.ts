import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

export function useFadeIn(delay = 0) {
  const opacity   = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(16)).current

  useEffect(() => {
    const t = delay > 0 ? setTimeout(start, delay) : null
    if (!t) start()
    return () => { if (t) clearTimeout(t) }
  }, [])

  function start() {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start()
  }

  return { opacity, translateY }
}
