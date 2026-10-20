import { useRef } from 'react'

// A vertical drag further than this moves the sheet one step; a shorter one counts as a tap.
const DRAG_THRESHOLD_PX = 30

// collapsed: only the handle shows, so the model has the whole screen. half: the lower part of
// the screen. full: most of the screen.
export type SheetState = 'collapsed' | 'half' | 'full'
const STATES: SheetState[] = ['collapsed', 'half', 'full']

const LABELS: Record<SheetState, string> = {
  collapsed: 'Avaa paneeli',
  half: 'Laajenna paneeli',
  full: 'Pienennä paneeli',
}

type Props = { state: SheetState; onChange: (state: SheetState) => void }

// Grab handle of the mobile bottom sheet: drag up to open one step, drag down to close one step
// (from half, only the handle is left), tap or press Enter/Space to open a collapsed sheet or
// to switch between half and full, arrow keys to move one step. Hidden on desktop by CSS.
export function SheetHandle({ state, onChange }: Props) {
  const startY = useRef<number | null>(null)
  const step = (by: number) => {
    const index = Math.min(Math.max(STATES.indexOf(state) + by, 0), STATES.length - 1)
    onChange(STATES[index])
  }
  const tap = () => onChange(state === 'half' ? 'full' : 'half')

  return (
    <button
      type="button"
      className="sheet-handle"
      aria-expanded={state !== 'collapsed'}
      aria-label={LABELS[state]}
      onPointerDown={(event) => {
        startY.current = event.clientY
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => {
        if (startY.current === null) return
        const dy = event.clientY - startY.current
        startY.current = null
        if (dy < -DRAG_THRESHOLD_PX) step(1)
        else if (dy > DRAG_THRESHOLD_PX) step(-1)
        else tap()
      }}
      onPointerCancel={() => {
        startY.current = null
      }}
      onClick={(event) => {
        // detail is 0 for keyboard activation; pointer taps are handled on pointerup.
        if (event.detail === 0) tap()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') step(1)
        else if (event.key === 'ArrowDown') step(-1)
        else return
        event.preventDefault()
      }}
    >
      <span className="sheet-grip" aria-hidden="true" />
    </button>
  )
}
