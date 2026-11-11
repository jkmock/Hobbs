// Sample data for the social screens until the API has follows and a feed (Phase 7).
// Delete this file once /feed and /friends exist.

import type { FlightSummary } from '../components/FlightCard'
import type { Leg, Point } from '../lib/types'
import { distanceNm } from '../lib/geo'

const AIRPORTS: Record<string, Point> = {
  RDU: { lat: 35.8776, lon: -78.7875 },
  GSO: { lat: 36.0978, lon: -79.9373 },
  TTA: { lat: 35.5826, lon: -79.1012 },
  BUY: { lat: 36.0485, lon: -79.4749 },
  INT: { lat: 36.1337, lon: -80.222 },
  JNX: { lat: 35.541, lon: -78.3903 },
  FAY: { lat: 34.9912, lon: -78.8803 },
  EWN: { lat: 35.073, lon: -77.0429 },
  IGX: { lat: 35.935, lon: -79.0659 },
}

function legs(...idents: string[]): Leg[] {
  return idents.slice(1).map((destination, i) => {
    const origin = idents[i]!
    const originPoint = AIRPORTS[origin]!
    const destinationPoint = AIRPORTS[destination]!
    return { order: i + 1, origin, destination, originPoint, destinationPoint, distanceNm: distanceNm(originPoint, destinationPoint) }
  })
}

const none = {
  dualReceivedTime: 0,
  soloTime: 0,
  picTime: 0,
  crossCountryTime: 0,
  nightTime: 0,
  nightLandingsFs: 0,
  nightLandingsTg: 0,
  actualInstrumentTime: 0,
  simulatedInstrumentTime: 0,
}

export type FeedItem = {
  id: string
  pilot: { firstName: string; lastName: string }
  flight: FlightSummary
  props: number
  comments: number
}

export const SAMPLE_FEED: FeedItem[] = [
  {
    id: 'f1',
    pilot: { firstName: 'Matthew', lastName: 'Brown' },
    flight: { ...none, flightDate: '2026-11-03', totalTime: 1.4, tailNumber: 'N123AB', legs: legs('RDU', 'GSO'), picTime: 1.4, crossCountryTime: 1.4, nightTime: 0.6, nightLandingsFs: 1 },
    props: 12,
    comments: 3,
  },
  {
    id: 'f2',
    pilot: { firstName: 'Mary', lastName: 'Albright' },
    flight: { ...none, flightDate: '2026-11-02', totalTime: 2.6, tailNumber: 'N456CD', legs: legs('RDU', 'FAY', 'EWN', 'RDU'), soloTime: 2.6, picTime: 2.6, crossCountryTime: 2.6 },
    props: 21,
    comments: 7,
  },
  {
    id: 'f3',
    pilot: { firstName: 'Brian', lastName: 'Garrett' },
    flight: { ...none, flightDate: '2026-11-01', totalTime: 1.1, tailNumber: 'N872JM', legs: legs('TTA', 'TTA'), dualReceivedTime: 1.1, simulatedInstrumentTime: 0.5 },
    props: 4,
    comments: 0,
  },
  {
    id: 'f4',
    pilot: { firstName: 'Kim', lastName: 'Sandoval' },
    flight: { ...none, flightDate: '2026-10-30', totalTime: 1.8, tailNumber: 'N123AB', legs: legs('IGX', 'INT', 'BUY', 'IGX'), dualReceivedTime: 1.8, crossCountryTime: 1.8 },
    props: 9,
    comments: 2,
  },
]

export type Person = { id: string; firstName: string; lastName: string; homeAirport: string }

export const SAMPLE_FRIENDS: Person[] = [
  { id: 'p1', firstName: 'Matthew', lastName: 'Brown', homeAirport: 'RDU' },
  { id: 'p2', firstName: 'Brian', lastName: 'Garrett', homeAirport: 'TTA' },
  { id: 'p3', firstName: 'Mary', lastName: 'Albright', homeAirport: 'RDU' },
  { id: 'p4', firstName: 'Richard', lastName: 'Carney', homeAirport: 'JNX' },
  { id: 'p5', firstName: 'Kim', lastName: 'Sandoval', homeAirport: 'IGX' },
  { id: 'p6', firstName: 'James', lastName: 'Patterson', homeAirport: 'GSO' },
]

export const SAMPLE_SUGGESTIONS: Person[] = [
  { id: 'p7', firstName: 'William', lastName: 'Elks', homeAirport: 'RDU' },
  { id: 'p8', firstName: 'Sandra', lastName: 'Knight', homeAirport: 'BUY' },
  { id: 'p9', firstName: 'Omar', lastName: 'Haddad', homeAirport: 'FAY' },
]
