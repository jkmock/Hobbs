import { useFlightPages } from './useFlights'
import { touchAndGoAirports } from '../lib/geo'
import { useFeedPages } from './useSocial'
import type { Flight } from '../lib/types'
import type { LoneAirport, RouteLeg } from '../components/FlightMap'

// The top few cards of the Feed and My Flights keep their mini maps ready (lib/mapPool's
// keepReady), so switching between the tabs never shows them loading; MapPreloader builds
// them ahead of the first visit. The pages and the preloader both name the slots from here.

export const KEPT_MAPS_PER_TAB = 2

export type KeptTab = 'feed' | 'flights'
export const keptSlot = (tab: KeptTab, index: number) =>
  index < KEPT_MAPS_PER_TAB ? `${tab}-${index}` : undefined

export type KeptRoute = { tab: KeptTab; slot: string; legs: RouteLeg[]; airports: LoneAirport[] }

// The routes those cards show, exactly as FlightCard draws them (legs and touch-and-go airports).
export function useKeptRoutes(): KeptRoute[] {
  const flightPages = useFlightPages()
  const myFlights = flightPages.data?.pages.flatMap((page) => page.items) ?? []
  const feedPages = useFeedPages()
  const feed = feedPages.data?.pages.flatMap((page) => page.items) ?? []
  const routes = (tab: KeptTab, flights: Flight[]) =>
    flights.slice(0, KEPT_MAPS_PER_TAB).flatMap((flight, i) =>
      flight.legs.length > 0
        ? [{ tab, slot: keptSlot(tab, i)!, legs: flight.legs, airports: touchAndGoAirports(flight.legs) }]
        : [],
    )
  return [
    ...routes('feed', feed),
    ...routes('flights', myFlights),
  ]
}
