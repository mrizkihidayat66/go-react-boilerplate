import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAuth } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError, type User, type UserPage } from '@/lib/api-client'
import { useDocumentTitle } from '@/lib/use-document-title'
import { formatDate } from '@/lib/utils'

// ---- List query state ----

interface ListParams {
  search: string
  role: string
  page: number
}

const emptyParams: ListParams = { search: '', role: '', page: 1 }

export function UsersPage() {
  useDocumentTitle('Users')
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useState<ListParams>(emptyParams)
  // Debounced search keeps keystrokes from firing a request each keydown.
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setParams((p) => ({ ...p, search: searchInput, page: 1 })), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [editing, setEditing] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)

  const queryKey = ['users', params] as const
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const q = new URLSearchParams()
      if (params.search) q.set('search', params.search)
      if (params.role) q.set('role', params.role)
      q.set('page', String(params.page))
      q.set('per_page', '10')
      return api.get<UserPage>(`/api/v1/users?${q.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        // e.g. deleting the last admin or yourself.
        const first = Object.values(err.fieldErrors ?? {})[0]
        toast.error(first?.[0] ?? 'Could not delete the user.')
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
      }
    },
  })

  const setPage = (page: number) => setParams((p) => ({ ...p, page }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">
            {list.data ? `${list.data.total} total` : 'Manage user accounts.'}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search name or email…"
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search users"
              />
            </div>
            <Select
              value={params.role || 'all'}
              onValueChange={(v) => setParams({ ...emptyParams, search: params.search, role: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading state */}
          {list.isPending && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Error state */}
          {list.isError && (
            <div className="text-destructive flex flex-col items-center gap-3 py-10 text-sm">
              <p>Could not load users.</p>
              <Button variant="outline" size="sm" onClick={() => list.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {list.data && list.data.users.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
              <p>No users found.</p>
              {(params.search || params.role) && (
                <Button variant="outline" size="sm" onClick={() => { setSearchInput(''); setParams(emptyParams) }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Data */}
          {list.data && list.data.users.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.users.map((u) => (
                    <TableRow key={u.id} className={list.isPlaceholderData ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {formatDate(u.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${u.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(u)}>Edit</DropdownMenuItem>
                            <ConfirmDialog
                              trigger={
                                <DropdownMenuItem variant="destructive" className="w-full justify-start" onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              }
                              title={`Delete ${u.name}?`}
                              description="This permanently removes the user and signs them out everywhere. This action cannot be undone."
                              confirmLabel="Delete"
                              onConfirm={() => remove.mutate(u.id)}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-muted-foreground text-sm">
                  Page {list.data.page} of {list.data.total_pages || 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={list.data.page <= 1 || list.isPlaceholderData}
                    onClick={() => setPage(list.data!.page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={list.data.page >= list.data.total_pages || list.isPlaceholderData}
                    onClick={() => setPage(list.data!.page + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <UserFormDialog open={creating} onOpenChange={setCreating} mode="create" />
      {editing && (
        <UserFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          mode="edit"
          user={editing}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}

// ---- Create / edit dialog ----

// Base schema: password is optional here (blank = keep current on edit).
// The mode-specific "required on create" rule is added by the resolver
// built inside the dialog, so the inferred type stays stable.
const userFormSchema = z.object({
  name: z.string().min(2, 'Must be at least 2 characters.').max(255, 'Must be at most 255 characters.'),
  email: z.string().email('Must be a valid email address.').max(255),
  role: z.enum(['user', 'admin']),
  is_active: z.boolean(),
  password: z
    .string()
    .min(8, 'Must be at least 8 characters.')
    .max(72, 'Must be at most 72 characters.')
    .or(z.literal(''))
    .optional(),
})

type UserFormValues = z.infer<typeof userFormSchema>

function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  currentUser,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  user?: User
  currentUser?: User | null
}) {
  const queryClient = useQueryClient()
  const isSelf = user !== undefined && currentUser !== null && user.id === currentUser?.id

  // A password is required when creating a user, but optional on edit.
  const resolver = useMemo(
    () =>
      zodResolver(
        userFormSchema.superRefine((values, ctx) => {
          if (mode === 'create' && !values.password) {
            ctx.addIssue({
              code: 'custom',
              path: ['password'],
              message: 'A password is required when creating a user.',
            })
          }
        }),
      ),
    [mode],
  )

  const form = useForm<UserFormValues>({
    resolver,
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'user',
      is_active: user?.is_active ?? true,
      password: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (mode === 'create') {
        return api.post<User>('/api/v1/users', {
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          is_active: values.is_active,
        })
      }
      // Partial update: omit the password when left blank.
      const body: Record<string, unknown> = {
        name: values.name,
        email: values.email,
        role: values.role,
        is_active: values.is_active,
      }
      if (values.password) body.password = values.password
      return api.put<User>(`/api/v1/users/${user!.id}`, body)
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'User created.' : 'User updated.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      onOpenChange(false)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        for (const [field, messages] of Object.entries(err.fieldErrors ?? {})) {
          if (field === 'is_active') continue // shown via root, rare
          form.setError(field as keyof UserFormValues, { message: messages[0] })
        }
      } else if (err instanceof ApiError && err.status === 409) {
        form.setError('email', { message: 'This email is already taken.' })
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New user' : `Edit ${user?.name}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a user account with a temporary password.'
              : 'Update account details, role or status.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">
              {mode === 'create' ? 'Password' : 'New password'}
            </Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              placeholder={mode === 'edit' ? 'Leave blank to keep current' : undefined}
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as 'user' | 'admin')}>
                <SelectTrigger aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-destructive text-sm">{form.formState.errors.role.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('is_active') ? 'active' : 'disabled'}
                onValueChange={(v) => form.setValue('is_active', v === 'active')}
                disabled={isSelf} // cannot deactivate yourself
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
