'use client'

import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', callback)
      return () => mq.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
