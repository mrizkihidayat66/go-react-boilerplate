import { useEffect } from 'react'

const BASE = 'Go React Starter'

/** Set the document title for the current page. Resets on unmount. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
    return () => {
      document.title = BASE
    }
  }, [title])
}
