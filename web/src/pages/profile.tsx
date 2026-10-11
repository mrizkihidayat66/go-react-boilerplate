import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api-client'
import { useDocumentTitle } from '@/lib/use-document-title'
import { formatDate } from '@/lib/utils'

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'This field is required.'),
  new_password: z.string().min(8, 'Must be at least 8 characters.').max(72, 'Must be at most 72 characters.'),
})

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export function ProfilePage() {
  useDocumentTitle('Profile')
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordForm) =>
      api.put('/api/v1/me/password', {
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      toast.success('Password changed. Other sessions have been signed out.')
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        for (const [field, messages] of Object.entries(err.fieldErrors ?? {})) {
          form.setError(field as keyof ChangePasswordForm, { message: messages[0] })
        }
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
      }
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Name</span>
              <span>{user?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Email</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Role</span>
              <span className="capitalize">{user?.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span>{user ? formatDate(user.created_at) : '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Change password</CardTitle>
            <CardDescription>
              Changing your password signs out all other sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <Input
                  id="current_password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register('current_password')}
                />
                {form.formState.errors.current_password && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.current_password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('new_password')}
                />
                {form.formState.errors.new_password && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.new_password.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
