import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AREAS } from './areas'
import { ChainView } from './ChainView'
import { meshesOf } from './data/connections'
import { muscles } from './data/muscles'
import { Disclaimer } from './Disclaimer'
import { FirstVisitNotice } from './FirstVisitNotice'
import { refName } from './labels'
import { MuscleInfo } from './MuscleInfo'
import { MuscleSearch } from './MuscleSearch'
import { PainResults } from './PainResults'
import { chainSteps, connectedMuscles, findPainSources, type PainSources } from './search/painSearch'
import { SheetHandle } from './SheetHandle'
import { SourcesDialog } from './SourcesDialog'
import { useReveal } from './useReveal'
import type { Layer, LayerVisibility } from './viewer/layers'
import type { PainPoint } from './viewer/PainPicker'
import type { BodyArea, BodySide } from './viewer/body'
import { REGION_NAMES } from './viewer/regions'
import { type Emphasis, type Focus, Viewer } from './viewer/Viewer'
import { ViewerErrorBoundary } from './ViewerErrorBoundary'

// The word "lihakset" is dropped on phones to fit the toolbar; the group label keeps the context.
const LAYER_LABELS: Record<Layer, string> = {
  superficial: 'Pinnalliset',
  deep: 'Syvät',
}

// pain: results for a pain point. chain: one distant source's chain for that pain point.
// muscle: a muscle's info.
type Selection =
  | { kind: 'pain'; pain: PainPoint }
  | { kind: 'chain'; pain: PainPoint; muscleId: string }
  | { kind: 'muscle'; id: string }
  | null

// One short line for screen readers when the panel changes, instead of reading the whole panel.
function statusText(selection: Selection, sources: PainSources | null): string {
  if (!selection) return ''
  if (selection.kind === 'muscle') return `Lihas: ${refName(`muscle:${selection.id}`)}`
  if (selection.kind === 'chain') return `Kytkösketju: ${refName(`muscle:${selection.muscleId}`)}`
  const region = REGION_NAMES[selection.pain.region]
  if (!sources) return region
  const muscles = (n: number) => `${n} ${n === 1 ? 'lihas' : 'lihasta'}`
  return `${region}: ${muscles(sources.local.length)} kipukohdassa, ${muscles(sources.distant.length)} kauempana`
}

// The back button names the view it returns to.
function backLabel(previous: NonNullable<Selection>): string {
  if (previous.kind === 'muscle') return refName(`muscle:${previous.id}`)
  if (previous.kind === 'chain') return 'Takaisin kytkösketjuun'
  return 'Takaisin tuloksiin'
}

function App() {
  const [layers, setLayers] = useState<LayerVisibility>({ superficial: true, deep: true })
  const [resetKey, setResetKey] = useState(0)
  const [selection, setSelection] = useState<Selection>(null)
  // Earlier selections, so the panel can go back from a muscle to the previous view.
  const [history, setHistory] = useState<Selection[]>([])
  const [sheetExpanded, setSheetExpanded] = useState(false)
  // An area jump applies until the selection changes; then the selection's own focus takes over.
  const [areaJump, setAreaJump] = useState<{ focus: Focus; selection: Selection } | null>(null)
  // false: the whole-body figure; true: the anatomy of the area zoomed into.
  const [showAnatomy, setShowAnatomy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const pain = selection?.kind === 'pain' || selection?.kind === 'chain' ? selection.pain : null
  const painSources = useMemo(
    () => (pain ? findPainSources(pain.nearby, pain.region) : null),
    [pain],
  )
  const selectedMuscle = selection?.kind === 'muscle' ? muscles.find((m) => m.id === selection.id) : undefined
  const connected = useMemo(() => (selectedMuscle ? connectedMuscles(selectedMuscle.id) : []), [selectedMuscle])
  const chain = useMemo(() => {
    if (selection?.kind !== 'chain' || !painSources) return null
    const source = painSources.distant.find((d) => d.muscle.id === selection.muscleId)
    return source ? chainSteps(source, selection.pain.region) : null
  }, [selection, painSources])
  const lit = useReveal(chain?.steps.length ?? 0, chain)

  const emphasis = useMemo<Emphasis | null>(() => {
    if (selectedMuscle) return { kind: 'muscle', muscle: selectedMuscle, connected }
    if (chain) return { kind: 'chain', steps: chain.steps, lit }
    return painSources ? { kind: 'sources', sources: painSources } : null
  }, [selectedMuscle, connected, chain, lit, painSources])

  // Depends on the selection itself, so choosing the same muscle again refocuses the camera.
  const selectionFocus = useMemo<Focus | null>(() => {
    if (selection?.kind === 'muscle' && selectedMuscle) {
      const { meshes, attachmentMeshes = [] } = selectedMuscle
      return { meshes, attachmentMeshes, aim: meshes }
    }
    if (chain) return { meshes: chain.steps.flatMap(meshesOf), attachmentMeshes: [], aim: meshesOf(chain.steps.at(-1)!) }
    return null
  }, [selection, selectedMuscle, chain])
  const focus = areaJump && areaJump.selection === selection ? areaJump.focus : selectionFocus

  const jumpToArea = (id: string) => {
    const area = AREAS.find((a) => a.id === id)
    if (!area) return
    const meshes = [...area.meshes]
    setShowAnatomy(true)
    setNotice(null)
    const view = 'view' in area ? area.view : undefined
    setAreaJump({ focus: { meshes, attachmentMeshes: [], aim: meshes, keepDirection: true, view }, selection })
  }

  // A part of the whole-body figure was clicked.
  const selectBodyArea = (area: BodyArea, side: BodySide) => {
    jumpToArea(area)
    if (side === 'left') setNotice('Vasen puoli on tulossa. Näytetään oikea puoli.')
  }

  const showWholeBody = () => {
    setShowAnatomy(false)
    setSelection(null)
    setHistory([])
    setNotice(null)
    setResetKey((key) => key + 1)
  }

  // Move focus to the new view's heading: the button that changed the view is usually gone.
  useEffect(() => {
    const panel = panelRef.current
    if (!selection || !panel) return
    panel.scrollTop = 0
    panel.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }, [selection])

  // Show the selected muscle's layer. Other muscles are see-through when dimmed, so a deep muscle
  // is visible without hiding the superficial ones.
  const selectMuscle = (id: string) => {
    const muscle = muscles.find((m) => m.id === id)
    if (!muscle) return
    setLayers({ ...layers, [muscle.layer]: true })
    setShowAnatomy(true)
    setNotice(null)
    if (selection && !(selection.kind === 'muscle' && selection.id === id)) setHistory([...history, selection])
    setSelection({ kind: 'muscle', id })
  }

  const goBack = () => {
    const previous = history.at(-1)
    if (!previous) return
    if (previous.kind === 'muscle') {
      const muscle = muscles.find((m) => m.id === previous.id)
      if (muscle) setLayers({ ...layers, [muscle.layer]: true })
    }
    setHistory(history.slice(0, -1))
    setSelection(previous)
  }

  // Stable, so the pick listeners are not re-attached on every render (e.g. during the chain animation).
  const handlePick = useCallback((picked: PainPoint) => {
    setHistory([])
    setSelection({ kind: 'pain', pain: picked })
  }, [])

  return (
    <main>
      <h1 className="visually-hidden">Lihastohtori</h1>
      <div className="viewer">
        <p className="visually-hidden">
          3D-malli koko kehosta. Kehon osan valinta ja kipukohdan valinta mallista vaativat hiiren tai
          kosketuksen. Lihaksia voi hakea hakukentästä.
        </p>
        <ViewerErrorBoundary>
          <Viewer
            layers={layers}
            resetKey={resetKey}
            showAnatomy={showAnatomy}
            onSelectBodyArea={selectBodyArea}
            painPoint={pain}
            emphasis={emphasis}
            focus={focus}
            onPick={handlePick}
          />
        </ViewerErrorBoundary>
        <div className="toolbar">
          <MuscleSearch onSelect={selectMuscle} />
          <select
            className="area-select"
            aria-label="Siirry alueelle"
            value=""
            onChange={(event) => jumpToArea(event.target.value)}
          >
            <option value="" disabled>
              Siirry
            </option>
            {AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
          <div className="layer-toggles" role="group" aria-label="Lihaskerrokset" hidden={!showAnatomy}>
            {(Object.keys(LAYER_LABELS) as Layer[]).map((layer) => (
              <button
                key={layer}
                type="button"
                aria-pressed={layers[layer]}
                onClick={() => setLayers({ ...layers, [layer]: !layers[layer] })}
              >
                {LAYER_LABELS[layer]}
                <span className="wide-only"> lihakset</span>
              </button>
            ))}
          </div>
        </div>
        {showAnatomy ? (
          <button type="button" className="reset-view" onClick={showWholeBody}>
            Koko keho
          </button>
        ) : (
          <button type="button" className="reset-view" onClick={() => setResetKey((key) => key + 1)}>
            Palauta näkymä
          </button>
        )}
      </div>
      <aside className="panel" ref={panelRef} data-sheet={sheetExpanded ? 'full' : 'half'}>
        <p className="visually-hidden" role="status">
          {statusText(selection, painSources)}
        </p>
        <SheetHandle expanded={sheetExpanded} onChange={setSheetExpanded} />
        {notice && <p className="notice-line">{notice}</p>}
        {pain && (
          <>
            <h2 className="region-name" tabIndex={-1} data-autofocus={selection?.kind === 'pain' || undefined}>
              {REGION_NAMES[pain.region]}
            </h2>
            {painSources && selection?.kind === 'pain' && (
              <PainResults
                sources={painSources}
                onSelectMuscle={selectMuscle}
                onOpenChain={(muscleId) => setSelection({ kind: 'chain', pain, muscleId })}
              />
            )}
            {chain && selection?.kind === 'chain' && (
              <ChainView
                muscleId={selection.muscleId}
                steps={chain.steps}
                links={chain.links}
                lit={lit}
                onBack={() => setSelection({ kind: 'pain', pain })}
                onSelectMuscle={selectMuscle}
              />
            )}
            <Disclaimer />
          </>
        )}
        {selectedMuscle && history.length > 0 && (
          <button type="button" onClick={goBack}>
            ← {backLabel(history.at(-1)!)}
          </button>
        )}
        {selectedMuscle && <MuscleInfo muscle={selectedMuscle} connected={connected} onSelectMuscle={selectMuscle} />}
        {!selection && (
          <p className="empty-state">
            {showAnatomy ? 'Klikkaa kohtaa, johon sattuu.' : 'Valitse kehon osa, jota haluat tutkia.'}
          </p>
        )}
        <SourcesDialog />
      </aside>
      <FirstVisitNotice />
    </main>
  )
}

export default App
