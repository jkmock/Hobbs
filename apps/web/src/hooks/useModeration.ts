import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CreateReport, ResolveReport } from '@hobbs/shared'
import { api } from '../lib/api'
import type { AdminReport, Person, ReportedTarget } from '../lib/types'

// Reporting and blocking (routes/social.ts and routes/moderation.ts in the API), and the
// admins' Reports page.

// Whatever was reported or blocked leaves the feed, comments, props and people lists at once:
// they're fetched again without it.
function refreshSocial(queryClient: QueryClient) {
  return Promise.all(
    ['feed', 'social', 'friends', 'people', 'blocks'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  )
}

export function useReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (report: CreateReport) => api<{ id: string }>('/reports', { method: 'POST', body: report }),
    onSuccess: () => refreshSocial(queryClient),
  })
}

export function useBlocks() {
  return useQuery({ queryKey: ['blocks'], queryFn: () => api<Person[]>('/blocks') })
}

// Block someone, or with `unblock`, let them back.
export function useBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, unblock }: { userId: string; unblock?: boolean }) =>
      api<void>(`/blocks/${userId}`, { method: unblock ? 'DELETE' : 'POST' }),
    onSuccess: () => refreshSocial(queryClient),
  })
}

// --- Admins ---

export function useAdminReports(status: 'open' | 'all') {
  return useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => api<AdminReport[]>(`/admin/reports?status=${status}`),
  })
}

// The reported post, comment or person, as it is now, to look at before acting.
export function useReportTarget(reportId: string) {
  return useQuery({
    queryKey: ['admin', 'reports', 'target', reportId],
    queryFn: () => api<{ target: ReportedTarget | null }>(`/admin/reports/${reportId}/target`),
    select: (data) => data.target,
  })
}

export function useResolveReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string } & ResolveReport) =>
      api<void>(`/admin/reports/${id}`, { method: 'POST', body: { action } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  })
}
