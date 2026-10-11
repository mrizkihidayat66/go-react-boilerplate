// Typed API client for the Go backend. Every request goes through
// request(), which attaches the CSRF token on mutations and normalizes
// errors into ApiError.

export interface User {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserPage {
  users: User[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

/** Field-level validation errors returned as 422 by the backend. */
export type FieldErrors = Record<string, string[]>

/** Normalized API error with status code and optional field errors. */
export class ApiError extends Error {
  status: number
  fieldErrors?: FieldErrors

  constructor(status: number, message: string, fieldErrors?: FieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** Whether the error is a validation failure with field details. */
  get isValidation(): boolean {
    return this.status === 422 && this.fieldErrors !== undefined
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
  return match ? match.substring(name.length + 1) : null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  // Mutations echo the csrf_token cookie (double-submit CSRF).
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('csrf_token')
    if (csrf) headers['X-CSRF-Token'] = csrf
  }

  let resp: Response
  try {
    resp = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Network error. Is the server running?')
  }

  if (resp.status === 204) {
    return undefined as T
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = (await resp.json()) as Record<string, unknown>
  } catch {
    // Non-JSON response (e.g. plain 500 from a proxy).
  }

  if (!resp.ok) {
    const message =
      typeof payload.message === 'string' ? payload.message : `Request failed (${resp.status}).`
    const fieldErrors = payload.errors as FieldErrors | undefined
    throw new ApiError(resp.status, message, fieldErrors)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
