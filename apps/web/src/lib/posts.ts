import type { Checkride, Flight } from './types'

// A list of posts: flights, and the checkrides passed among them.
export type PostEntry<F, C> = { kind: 'flight'; flight: F } | { kind: 'checkride'; checkride: C }

// Flights and checkrides in one list, newest first (by date, then when they were logged). The
// flights' own order is kept as it is (the API's).
export function mergeByDate<F extends Pick<Flight, 'flightDate' | 'createdAt'>, C extends Pick<Checkride, 'passedOn' | 'createdAt'>>(
  flights: F[],
  checkrides: C[],
): PostEntry<F, C>[] {
  const later = (c: C, f: F) => c.passedOn > f.flightDate || (c.passedOn === f.flightDate && c.createdAt > f.createdAt)
  const rest = [...checkrides].sort((a, b) =>
    a.passedOn === b.passedOn ? b.createdAt.localeCompare(a.createdAt) : b.passedOn.localeCompare(a.passedOn),
  )
  const entries: PostEntry<F, C>[] = []
  for (const flight of flights) {
    while (rest[0] && later(rest[0], flight)) entries.push({ kind: 'checkride', checkride: rest.shift()! })
    entries.push({ kind: 'flight', flight })
  }
  for (const checkride of rest) entries.push({ kind: 'checkride', checkride })
  return entries
}
