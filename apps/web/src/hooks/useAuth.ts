import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import type { LoginSchema, SetPasswordSchema, SignupSchema } from '@hobbs/shared'
import { api, ApiError } from '../lib/api'
import { signInWithApple, signInWithGoogle } from '../lib/nativeAuth'
import type { User } from '../lib/types'

const ME_KEY = ['me']

// Who is logged in? `data` is the user, or null when logged out.
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    retry: false,
  })
}

// After login/signup, put the returned user straight into the cache,
// so every component using useMe() updates without another request.

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: z.input<typeof LoginSchema>) => api<User>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: z.input<typeof SignupSchema>) => api<User>('/auth/signup', { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

// In the iOS app: Sign in with Apple (the API checks Apple's token and signs in).
export function useAppleSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => api<User>('/auth/apple', { method: 'POST', body: await signInWithApple() }),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

// In the iOS app: Google, in Apple's sign-in sheet. The session is stored natively; then who's
// logged in is asked again.
export function useGoogleSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await signInWithGoogle()
      return api<User>('/auth/me')
    },
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

// The first password for an account made with Google (SetPasswordPage).
export function useSetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: z.input<typeof SetPasswordSchema>) => api<User>('/auth/password', { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    // Throw away every cached query: none of it belongs to the next user.
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(ME_KEY, null)
    },
  })
}

// Your name or picture changed: show it everywhere at once. The cached user is replaced, and
// lists that show you beside your flights and comments are fetched again.
function useProfileSaved() {
  const queryClient = useQueryClient()
  return (user: User) => {
    queryClient.setQueryData(ME_KEY, user)
    for (const key of ['feed', 'friends', 'people', 'social']) queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useUpdateName() {
  const saved = useProfileSaved()
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string }) => api<User>('/profile', { method: 'PATCH', body }),
    onSuccess: saved,
  })
}

// `image` is a data URL, already shrunk (lib/avatarImage).
export function useSetAvatar() {
  const saved = useProfileSaved()
  return useMutation({
    mutationFn: (image: string) => api<User>('/profile/avatar', { method: 'PUT', body: { image } }),
    onSuccess: saved,
  })
}

export function useRemoveAvatar() {
  const saved = useProfileSaved()
  return useMutation({
    mutationFn: () => api<User>('/profile/avatar', { method: 'DELETE' }),
    onSuccess: saved,
  })
}

// Deletes the account and everything in it (flights, friends, props, comments), then forgets
// every cached query, as logging out does.
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/me', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(ME_KEY, null)
    },
  })
}
