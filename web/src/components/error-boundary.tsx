// ErrorBoundary catches render-time exceptions anywhere below it in the
// tree and shows a recovery screen instead of a white page. Server-side
// errors (failed queries) are handled by the pages themselves; this is
// the last line of defense for bugs in the UI code.

import { AlertTriangle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console for development; a production app would
    // forward this to an error tracker.
    console.error('Render error caught by boundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4 text-center">
            <AlertTriangle className="text-destructive mx-auto size-10" />
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred while rendering this page.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
