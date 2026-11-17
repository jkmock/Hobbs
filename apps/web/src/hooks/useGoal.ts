import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { GoalId } from '@hobbs/shared'
import { api } from '../lib/api'
import type { Checkride } from '../lib/types'
import { todayIso } from '../lib/format'

export type GoalSettings = { goal: GoalId; adjustments: Record<string, number>; checkrides: Checkride[] }

const GOAL_KEY = ['goal']

// The Goal tab's settings: the goal, the pilot's adjustments to its stats, and the checkrides
// they've passed.
export function useGoal() {
  return useQuery({ queryKey: GOAL_KEY, queryFn: () => api<GoalSettings>('/goal') })
}

export function useSaveGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Pick<GoalSettings, 'goal' | 'adjustments'>) => api<GoalSettings>('/goal', { method: 'PUT', body }),
    onSuccess: (saved) => queryClient.setQueryData(GOAL_KEY, saved),
  })
}

// A checkride passed today (the phone's date). The feed shows it (to friends too, when public).
export function useLogCheckride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { goal: GoalId; visibility: 'public' | 'private' }) =>
      api<GoalSettings>('/checkrides', { method: 'POST', body: { ...body, passedOn: todayIso() } }),
    onSuccess: (saved) => {
      queryClient.setQueryData(GOAL_KEY, saved)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

// Make one of your checkrides public or private. My flights shows the change at once; the
// Goal tab and the feed are fetched again.
export function useUpdateCheckride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: 'public' | 'private' }) =>
      api<Checkride>(`/checkrides/${id}`, { method: 'PATCH', body: { visibility } }),
    onSuccess: (saved) => {
      queryClient.setQueriesData<InfiniteData<{ checkrides?: Checkride[] }>>({ queryKey: ['flights', 'pages'] }, (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, checkrides: p.checkrides?.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)) })),
        },
      )
      queryClient.invalidateQueries({ queryKey: GOAL_KEY })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

// Remove one of your checkrides: off the Goal tab at once, and out of My flights and the feed.
export function useRemoveCheckride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<GoalSettings>(`/checkrides/${id}`, { method: 'DELETE' }),
    onSuccess: (saved) => {
      queryClient.setQueryData(GOAL_KEY, saved)
      queryClient.invalidateQueries({ queryKey: ['flights', 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
