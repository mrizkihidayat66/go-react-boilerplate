import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/use-document-title'

// Rendered for unknown URLs. Kept outside the auth redirect so it works
// whether or not a session exists.
export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
