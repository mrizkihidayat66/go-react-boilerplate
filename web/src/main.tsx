import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'

import { AuthProvider, useAuth } from '@/auth/auth-context'
import { AppLayout } from '@/components/app-layout'
import { ErrorBoundary } from '@/components/error-boundary'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'
import { NotFoundPage } from '@/pages/not-found'
import { ProfilePage } from '@/pages/profile'
import { RegisterPage } from '@/pages/register'
import './index.css'

// The two heaviest pages split into their own chunks: they pull the
// table, dialogs and select primitives that the login/dashboard flow
// never needs. Everything else ships in the main bundle.
const UsersPage = lazy(() =>
  import('@/pages/users').then((m) => ({ default: m.UsersPage })),
)
const ComponentsPage = lazy(() =>
  import('@/pages/components').then((m) => ({ default: m.ComponentsPage })),
)
const PatternsPage = lazy(() =>
  import('@/pages/patterns').then((m) => ({ default: m.PatternsPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** Blocks the subtree until the initial session check resolves. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="bg-muted flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="border-primary border-t-primary size-4 animate-spin rounded-full border-2" />
          Loading…
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

/** Redirects authenticated users away from auth pages. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <RegisterPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="components"
          element={
            <Suspense fallback={<PageFallback />}>
              <ComponentsPage />
            </Suspense>
          }
        />
        <Route
          path="patterns"
          element={
            <Suspense fallback={<PageFallback />}>
              <PatternsPage />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <Suspense fallback={<PageFallback />}>
                <UsersPage />
              </Suspense>
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

/** Gates admin-only routes; must be inside RequireAuth. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        You do not have permission to view this page.
      </div>
    )
  }
  return <>{children}</>
}

/** Full-page spinner shown while a lazy route chunk loads. */
function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="border-primary border-t-primary size-6 animate-spin rounded-full border-2" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
