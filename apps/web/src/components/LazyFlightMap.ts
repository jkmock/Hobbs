import { lazy } from 'react'

// FlightMap, loaded on first use (the map library is large). One shared lazy component, so
// once any map has loaded it, every other map (a card's, the Map tab's, MapPreloader's)
// renders straight away instead of waiting a render for its own copy to resolve.
export const LazyFlightMap = lazy(() => import('./FlightMap'))
