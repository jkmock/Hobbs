import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
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

// One flight. With `fromList`, it shows the copy already loaded for My flights (or the map)
// straight away while the fresh one loads, so the flight page has its card at once.
export function useFlight(id: string | undefined, { fromList = false } = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['flights', 'one', id],
    queryFn: () => api<Flight>(`/flights/${id}`),
    enabled: id !== undefined,
    placeholderData: () => {
      if (!fromList || !id) return undefined
      const pages = queryClient.getQueryData<InfiniteData<Page<Flight>>>(['flights', 'pages'])
      const all = queryClient.getQueryData<Flight[]>(['flights', 'all'])
      return pages?.pages.flatMap((page) => page.items).find((f) => f.id === id) ?? all?.find((f) => f.id === id)
    },
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft', 'mine'] }) // a newly flown aircraft joins "Your aircraft"
      // My flights is reloaded before the save counts as done, so it already has the flight
      // when it opens, and a new one can pop in there rather than appear late and shove the
      // list down.
      const list = queryClient.invalidateQueries({ queryKey: ['flights', 'pages'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      await list
    },
  })
}

export function useDeleteFlight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/flights/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flights'] }),
  })
}
