// Shapes of the JSON the API sends back. Request bodies use the Zod types
// from @hobbs/shared instead (e.g. CreateFlight).

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
}

export type Point = { lat: number; lon: number }

export type Leg = {
  order: number
  origin: string
  destination: string
  originPoint: Point
  destinationPoint: Point
  distanceNm: number
  faFlightId?: string | null // set when imported from FlightAware
  track?: [number, number][] | null // [lon, lat] positions FlightAware recorded
}

// A flight FlightAware saw for a tail number (GET /flightaware/recent).
// origin/destination are idents we know, or null; the *Code fields are FlightAware's, for display.
export type RecentFlight = {
  faFlightId: string
  origin: string | null
  destination: string | null
  originCode: string | null
  destinationCode: string | null
  departedAt: string
  arrivedAt: string | null
}

export type Flight = {
  id: string
  aircraftId: string
  tailNumber: string
  instructorId: string | null
  instructorName: string | null
  flightDate: string // YYYY-MM-DD
  departureTime: string | null
  arrivalTime: string | null
  totalTime: number
  dualReceivedTime: number
  soloTime: number
  picTime: number
  crossCountryTime: number
  nightTime: number
  actualInstrumentTime: number
  simulatedInstrumentTime: number
  dayLandingsFs: number
  dayLandingsTg: number
  nightLandingsFs: number
  nightLandingsTg: number
  instrumentApproaches: number
  notes: string | null
  legs: Leg[]
  createdAt: string
  updatedAt: string
}

export type Aircraft = {
  id: string
  tailNumber: string
  make: string
  model: string
  year: number | null
  aircraftClass: 'single_engine_land' | 'multi_engine_land'
  isTailwheel: boolean
  isComplex: boolean
  isHighPerf: boolean
}

export type Instructor = {
  id: string
  firstName: string
  lastName: string
}

export type Airport = {
  ident: string
  name: string
  type: string
  latitude: number
  longitude: number
}

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}
