// Authentication state for the SPA. The current user is a TanStack Query
// cache entry keyed on ['me']; login/logout mutate it. Protected routes
// gate on this query's states.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext } from 'react'

import { api, type User } from '@/lib/api-client'

interface AuthValue {
  /** The logged-in user, or null once the check has completed. */
  user: User | null
  /** True while the initial session check is in flight. */
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

async function fetchMe(): Promise<User | null> {
  const data = await api.get<{ user: User }>('/api/v1/me')
  return data.user
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await fetchMe()
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const setUser = (user: User | null) => {
    queryClient.setQueryData(['me'], user)
    if (user === null) {
      // Clear any user-scoped caches on logout.
      queryClient.removeQueries({ queryKey: ['users'] })
    }
  }

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: User }>('/api/v1/auth/login', { email, password })
    setUser(data.user)
    return data.user
  }

  const register = async (name: string, email: string, password: string) => {
    const data = await api.post<{ user: User }>('/api/v1/auth/register', { name, email, password })
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await api.post('/api/v1/auth/logout')
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: meQuery.data ?? null,
        loading: meQuery.isPending,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** Access authentication state. Must be used inside AuthProvider. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
