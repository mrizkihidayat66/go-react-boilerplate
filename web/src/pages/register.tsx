import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { useDocumentTitle } from '@/lib/use-document-title'

const registerSchema = z.object({
  name: z.string().min(2, 'Must be at least 2 characters.').max(255, 'Must be at most 255 characters.'),
  email: z.string().email('Must be a valid email address.').max(255),
  password: z
    .string()
    .min(8, 'Must be at least 8 characters.')
    .max(72, 'Must be at most 72 characters.'),
})

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  useDocumentTitle('Register')
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: RegisterForm) => registerUser(values.name, values.email, values.password),
    onSuccess: () => navigate('/', { replace: true }),
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        for (const [field, messages] of Object.entries(err.fieldErrors ?? {})) {
          form.setError(field as keyof RegisterForm, { message: messages[0] })
        }
      } else if (err instanceof ApiError && err.status === 409) {
        form.setError('email', { message: 'This email is already taken.' })
      } else {
        form.setError('root', {
          message: err instanceof ApiError ? err.message : 'Something went wrong.',
        })
      }
    },
  })

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            The first account created becomes the administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
              )}
            </div>

            {form.formState.errors.root && (
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
