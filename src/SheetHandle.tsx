import { useRef } from 'react'

// A vertical drag further than this opens or closes the sheet; a shorter one counts as a tap.
const DRAG_THRESHOLD_PX = 30

type Props = { expanded: boolean; onChange: (expanded: boolean) => void }

// Grab handle of the mobile bottom sheet: drag up to open fully, down to go back to half,
// tap or press Enter/Space to toggle. Hidden on desktop by CSS.
export function SheetHandle({ expanded, onChange }: Props) {
  const startY = useRef<number | null>(null)

  return (
    <button
      type="button"
      className="sheet-handle"
      aria-expanded={expanded}
      aria-label={expanded ? 'Pienennä paneeli' : 'Laajenna paneeli'}
      onPointerDown={(event) => {
        startY.current = event.clientY
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => {
        if (startY.current === null) return
        const dy = event.clientY - startY.current
        startY.current = null
        if (dy < -DRAG_THRESHOLD_PX) onChange(true)
        else if (dy > DRAG_THRESHOLD_PX) onChange(false)
        else onChange(!expanded)
      }}
      onPointerCancel={() => {
        startY.current = null
      }}
      onClick={(event) => {
        // detail is 0 for keyboard activation; pointer taps are handled on pointerup.
        if (event.detail === 0) onChange(!expanded)
      }}
    >
      <span className="sheet-grip" aria-hidden="true" />
    </button>
  )
}
