import { useEffect, useState } from 'react'

const STEP_MS = 150

// How many of `total` steps are shown: one at first, one more every STEP_MS after `key`
// changes, or all at once with reduced motion.
export function useReveal(total: number, key: unknown): number {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [progress, setProgress] = useState<{ key: unknown; shown: number }>({ key: undefined, shown: 0 })

  useEffect(() => {
    if (reducedMotion) return
    const timers = Array.from({ length: Math.max(total - 1, 0) }, (_, i) =>
      setTimeout(() => setProgress({ key, shown: i + 2 }), STEP_MS * (i + 1)),
    )
    return () => timers.forEach(clearTimeout)
  }, [total, key, reducedMotion])

  if (reducedMotion) return total
  return Math.min(progress.key === key ? progress.shown : 1, total)
}
