import { apiBase, isNative } from './native'

// Every request to the backend goes through here.

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Send the session cookie. In the iOS app fetch() goes through native networking
    // (CapacitorHttp in capacitor.config.ts), which keeps and sends the cookie itself.
    credentials: isNative ? 'include' : 'same-origin',
  })

  // 204 No Content (logout, delete) has no body to parse.
  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    // The API always sends { error: "..." } for failures.
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`
    throw new ApiError(response.status, message, data)
  }

  return data as T
}
