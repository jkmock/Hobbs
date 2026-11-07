import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateFlight } from '@hobbs/shared'
import { api } from '../lib/api'
import type { Flight, Page } from '../lib/types'

// Every flight query key starts with 'flights', so invalidating ['flights'] refreshes them all.

function pageUrl(limit: number, cursor: string | null) {
  return `/flights?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
}

// The logbook list: 20 at a time, "load more" fetches the next page.
export function useFlightPages() {
  return useInfiniteQuery({
    queryKey: ['flights', 'pages'],
    queryFn: ({ pageParam }) => api<Page<Flight>>(pageUrl(20, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

// Every flight, for totals, progress and the map. Walks the cursor until the end.
export function useAllFlights() {
  return useQuery({
    queryKey: ['flights', 'all'],
    queryFn: async () => {
      const flights: Flight[] = []
      let cursor: string | null = null
      do {
        const page: Page<Flight> = await api<Page<Flight>>(pageUrl(100, cursor))
        flights.push(...page.items)
        cursor = page.nextCursor
      } while (cursor)
      return flights
    },
  })
}

export function useFlight(id: string | undefined) {
  return useQuery({
    queryKey: ['flights', 'one', id],
    queryFn: () => api<Flight>(`/flights/${id}`),
    enabled: id !== undefined,
  })
}

// POST when creating, PUT when editing.
export function useSaveFlight(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateFlight) =>
      id
        ? api<Flight>(`/flights/${id}`, { method: 'PUT', body })
        : api<Flight>('/flights', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flights'] }),
  })
}

export function useDeleteFlight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/flights/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flights'] }),
  })
}
