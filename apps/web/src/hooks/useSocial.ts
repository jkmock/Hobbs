import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Comment, FeedFlight, Flight, Friends, Page, PersonStatus, PersonWithStatus, PropGiver, Social } from '../lib/types'

// Friends, the feed, props and comments.
//
// Query keys: ['feed', ...] for the feed, ['friends'] and ['people', q] for people, and
// ['social', flightId, 'props' | 'comments'] for a flight's props and comments. A flight's
// counts live on the flight itself, in the feed's and My flights' caches (patchFlight).

// --- People and friends ---

export function useFriends() {
  return useQuery({ queryKey: ['friends'], queryFn: () => api<Friends>('/friends') })
}

// People to add, by name or exact email; nothing until two letters are typed.
export function usePeople(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['people', q],
    queryFn: () => api<PersonWithStatus[]>(`/people?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    placeholderData: (previous) => previous, // keep the last results while typing
  })
}

// Ask, accept (asking someone who asked you), or, with `remove`, unfriend, cancel or decline.
export function useFriendship() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, remove }: { userId: string; remove?: boolean }) =>
      api<{ status: PersonStatus } | undefined>(`/friends/${userId}`, { method: remove ? 'DELETE' : 'POST' }),
    onSuccess: () =>
      Promise.all(['friends', 'people', 'feed'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

// --- The feed ---

function feedUrl(cursor: string | null) {
  return `/feed?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
}

export function useFeedPages() {
  return useInfiniteQuery({
    queryKey: ['feed', 'pages'],
    queryFn: ({ pageParam }) => api<Page<FeedFlight>>(feedUrl(pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

// One feed flight, for a link to one that isn't in the loaded part of the feed.
export function useFeedFlight(id: string | undefined) {
  return useQuery({
    queryKey: ['feed', id],
    queryFn: () => api<FeedFlight>(`/feed/${id}`),
    enabled: !!id,
  })
}

// --- Props ---

export function usePropGivers(flightId: string | undefined) {
  return useQuery({
    queryKey: ['social', flightId, 'props'],
    queryFn: () => api<PropGiver[]>(`/flights/${flightId}/props`),
    enabled: !!flightId,
  })
}

// Give props, or take them back. The star and count change at once; the server's answer then
// sets them for sure (or puts them back if it failed).
export function useToggleProps() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ flightId, give }: { flightId: string; give: boolean }) =>
      api<Social>(`/flights/${flightId}/props`, { method: give ? 'POST' : 'DELETE' }),
    onMutate: ({ flightId, give }) => {
      patchFlight(queryClient, flightId, (f) =>
        f.proppedByMe === give ? f : { ...f, proppedByMe: give, propsCount: Math.max(0, (f.propsCount ?? 0) + (give ? 1 : -1)) },
      )
    },
    onSuccess: (social, { flightId }) => patchFlight(queryClient, flightId, (f) => ({ ...f, ...social })),
    onError: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
    onSettled: (_data, _error, { flightId }) => queryClient.invalidateQueries({ queryKey: ['social', flightId, 'props'] }),
  })
}

// --- Comments ---

export function useComments(flightId: string | undefined) {
  return useQuery({
    queryKey: ['social', flightId, 'comments'],
    queryFn: () => api<Comment[]>(`/flights/${flightId}/comments`),
    enabled: !!flightId,
  })
}

export function useAddComment(flightId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api<Comment>(`/flights/${flightId}/comments`, { method: 'POST', body: { body } }),
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(['social', flightId, 'comments'], (list) => [...(list ?? []), comment])
      patchFlight(queryClient, flightId, (f) => ({ ...f, commentsCount: (f.commentsCount ?? 0) + 1 }))
    },
  })
}

export function useDeleteComment(flightId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => api<void>(`/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData<Comment[]>(['social', flightId, 'comments'], (list) => list?.filter((c) => c.id !== commentId))
      patchFlight(queryClient, flightId, (f) => ({ ...f, commentsCount: Math.max(0, (f.commentsCount ?? 0) - 1) }))
    },
  })
}

// --- Keeping a flight's counts current everywhere it's cached ---

// Applies `update` to the flight with this id wherever it's cached: the feed's pages and single
// feed flights, and My flights' pages, its every-flight list and single flights.
function patchFlight(queryClient: QueryClient, flightId: string, update: <F extends Flight>(f: F) => F) {
  const patch = (data: unknown): unknown => {
    if (!data || typeof data !== 'object') return data
    if (Array.isArray(data)) return data.map((f: Flight) => (f.id === flightId ? update(f) : f))
    if ('pages' in data) {
      const pages = data as InfiniteData<Page<Flight>>
      return { ...pages, pages: pages.pages.map((p) => ({ ...p, items: p.items.map((f) => (f.id === flightId ? update(f) : f)) })) }
    }
    const flight = data as Flight
    return flight.id === flightId ? update(flight) : data
  }
  queryClient.setQueriesData({ queryKey: ['feed'] }, patch)
  queryClient.setQueriesData({ queryKey: ['flights'] }, patch)
}
