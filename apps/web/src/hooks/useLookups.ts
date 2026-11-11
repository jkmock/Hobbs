import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateAircraft } from '@hobbs/shared'
import { api } from '../lib/api'
import type { Aircraft, Airport, Instructor, RecentFlight } from '../lib/types'

const TAIL_SEARCH = /^[A-Z0-9-]{1,10}$/

export function useAircraftSearch(term: string) {
  const tail = term.trim().toUpperCase()
  return useQuery({
    queryKey: ['aircraft', 'search', tail],
    queryFn: () => api<Aircraft[]>(`/aircraft?tail=${encodeURIComponent(tail)}`),
    enabled: TAIL_SEARCH.test(tail),
  })
}

// Aircraft you've added or logged a flight in, most recently used first.
export function useMyAircraft() {
  return useQuery({
    queryKey: ['aircraft', 'mine'],
    queryFn: () => api<Aircraft[]>('/aircraft/mine'),
  })
}

// Adds an aircraft already in Hobbs to your aircraft.
export function useAddMyAircraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (aircraftId: string) => api<Aircraft>('/aircraft/mine', { method: 'POST', body: { aircraftId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aircraft'] }),
  })
}

export function useCreateAircraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAircraft) => api<Aircraft>('/aircraft', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aircraft'] }),
  })
}

export function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: () => api<Instructor[]>('/instructors'),
  })
}

export function useCreateInstructor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string }) =>
      api<Instructor>('/instructors', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  })
}

export function useDeleteInstructor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/instructors/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  })
}

// Looks up several airports at once (one cached query each).
// Returns ident -> Airport, null for "not found", or undefined while loading or too short.
export function useAirports(idents: string[]): Map<string, Airport | null | undefined> {
  const unique = [...new Set(idents.map((i) => i.trim().toUpperCase()).filter((i) => i.length >= 3))]
  const results = useQueries({
    queries: unique.map((ident) => ({
      queryKey: ['airport', ident],
      queryFn: () => api<Airport>(`/airports/${encodeURIComponent(ident)}`),
      retry: false,
      staleTime: Infinity, // airports don't move
    })),
  })

  const byIdent = new Map<string, Airport | null | undefined>()
  unique.forEach((ident, i) => {
    const result = results[i]
    byIdent.set(ident, result?.isError ? null : result?.data)
  })
  return byIdent
}

// Flights FlightAware saw for this tail number in the last ~10 days. Each fetch is billed,
// so results are kept for 10 minutes and failures aren't retried.
export function useRecentFlights(tailNumber: string) {
  const tail = tailNumber.trim().toUpperCase()
  return useQuery({
    queryKey: ['flightaware', 'recent', tail],
    queryFn: () => api<RecentFlight[]>(`/flightaware/recent?tail=${encodeURIComponent(tail)}`),
    enabled: TAIL_SEARCH.test(tail),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}
