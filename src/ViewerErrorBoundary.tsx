import { Component, type ReactNode } from 'react'

type State = { failed: boolean }

// The 3D view can fail on its own (model file missing, WebGL unavailable). The rest of the app,
// including the search, the sources and the disclaimer, keeps working.
export class ViewerErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="viewer-error" role="alert">
          3D-mallia ei voitu näyttää. Lihashaku ja lähteet toimivat silti. Kokeile ladata sivu uudelleen.
        </p>
      )
    }
    return this.props.children
  }
}
