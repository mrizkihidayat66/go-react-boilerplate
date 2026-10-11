import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/auth/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type UserPage } from '@/lib/api-client'
import { useDocumentTitle } from '@/lib/use-document-title'
import { formatDate } from '@/lib/utils'

// The dashboard is a minimal landing page demonstrating the standard
// query states (loading skeleton / error / data) with one live query —
// the most recent users — for admins, and a welcome card for everyone.
export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const recent = useQuery({
    queryKey: ['users', 'recent'],
    queryFn: () => api.get<UserPage>('/api/v1/users?per_page=5'),
    enabled: isAdmin,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Signed in as {user?.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Account</CardDescription>
            <CardTitle className="text-lg">{user?.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Role: {user?.role === 'admin' ? 'Administrator' : 'User'}
            <br />
            Member since {user ? formatDate(user.created_at) : '—'}
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardDescription>Starter checklist</CardDescription>
            <CardTitle className="text-lg">Where to go next</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Add a domain package under internal/ (service + models).</li>
              <li>Add routes in internal/httpapi/router.go.</li>
              <li>Add a query module under web/src (api + hooks).</li>
              <li>Generate a migration: see docs/architecture.md.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent users</CardTitle>
            <CardDescription>The five most recently created accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.isPending && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {recent.isError && (
              <p className="text-destructive text-sm">Could not load recent users.</p>
            )}
            {recent.data && (
              <ul className="divide-y">
                {recent.data.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {u.name} <span className="text-muted-foreground">· {u.email}</span>
                    </span>
                    <span className="text-muted-foreground text-xs">{formatDate(u.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
