import { useEffect, useRef } from 'react'
import { Disclaimer } from './Disclaimer'

const STORAGE_KEY = 'lihastohtori.notice-seen'

function hasSeenNotice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberNoticeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable: the notice is shown again on the next visit.
  }
}

export function FirstVisitNotice() {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open && !hasSeenNotice()) dialog.showModal()
  }, [])

  return (
    <dialog ref={ref} className="notice" aria-labelledby="notice-title" onClose={rememberNoticeSeen}>
      <h2 id="notice-title">Mistä kipu voi tulla?</h2>
      <p>
        Klikkaa mallista kohtaa, johon sattuu. Lihastohtori näyttää lihakset, jotka voivat liittyä
        kipuun siinä kohdassa.
      </p>
      <Disclaimer />
      <form method="dialog">
        <button autoFocus>Aloita</button>
      </form>
    </dialog>
  )
}
