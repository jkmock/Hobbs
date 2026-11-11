import { useAirports } from '../../hooks/useLookups'
import { distanceNm } from '../../lib/geo'
import { todayIso } from '../../lib/format'
import type { Flight } from '../../lib/types'

// The form's working copy of a flight. Numbers are kept as strings while editing
// (so "1." can be typed); toInput() converts them, then CreateFlightSchema validates.

export const TIME_FIELDS = [
  ['totalTime', 'Total time'],
  ['dualReceivedTime', 'Dual received'],
  ['soloTime', 'Solo'],
  ['picTime', 'PIC'],
  ['crossCountryTime', 'Cross-country'],
  ['nightTime', 'Night'],
  ['actualInstrumentTime', 'Actual instrument'],
  ['simulatedInstrumentTime', 'Simulated instrument'],
] as const

export const LANDING_FIELDS = [
  ['dayLandingsFs', 'Day full stop'],
  ['dayLandingsTg', 'Day touch and go'],
  ['nightLandingsFs', 'Night full stop'],
  ['nightLandingsTg', 'Night touch and go'],
  ['instrumentApproaches', 'Instrument approaches'],
] as const

export type TimeField = (typeof TIME_FIELDS)[number][0]
export type LandingField = (typeof LANDING_FIELDS)[number][0]

export type DraftLeg = { origin: string; destination: string; faFlightId?: string } // faFlightId: imported from FlightAware

export type Draft = {
  aircraftId: string
  tailNumber: string // for display; the API only needs aircraftId
  flightDate: string
  instructorId: string // '' = no instructor
  legs: DraftLeg[]
  times: Record<TimeField, string>
  landings: Record<LandingField, string>
  notes: string
}

export type StepProps = {
  draft: Draft
  update: (patch: Partial<Draft>) => void
  errors: Record<string, string>
}

// Which top-level fields each step owns, to show errors on the right step.
export const STEPS = [
  { title: 'Aircraft', fields: ['aircraftId', 'flightDate', 'instructorId'] },
  { title: 'Route', fields: ['legs'] },
  { title: 'Times', fields: TIME_FIELDS.map(([key]) => key) },
  { title: 'Landings', fields: [...LANDING_FIELDS.map(([key]) => key), 'notes'] },
] as const

const mapFields = <K extends string>(fields: readonly (readonly [K, string])[], value: (key: K) => string) =>
  Object.fromEntries(fields.map(([key]) => [key, value(key)])) as Record<K, string>

export function emptyDraft(): Draft {
  return {
    aircraftId: '',
    tailNumber: '',
    flightDate: todayIso(),
    instructorId: '',
    legs: [{ origin: '', destination: '' }],
    times: mapFields(TIME_FIELDS, () => '0.0'),
    landings: mapFields(LANDING_FIELDS, () => '0'),
    notes: '',
  }
}

export function draftFromFlight(f: Flight): Draft {
  return {
    aircraftId: f.aircraftId,
    tailNumber: f.tailNumber,
    flightDate: f.flightDate,
    instructorId: f.instructorId ?? '',
    legs: f.legs.map(({ origin, destination, faFlightId }) => ({ origin, destination, faFlightId: faFlightId ?? undefined })),
    times: mapFields(TIME_FIELDS, (key) => f[key].toFixed(1)),
    landings: mapFields(LANDING_FIELDS, (key) => String(f[key])),
    notes: f.notes ?? '',
  }
}

// Draft -> the request body shape. Not validated yet: CreateFlightSchema does that.
export function toInput(d: Draft): unknown {
  const number = (s: string) => (s.trim() === '' ? undefined : Number(s))
  return {
    aircraftId: d.aircraftId,
    flightDate: d.flightDate,
    instructorId: d.instructorId || undefined,
    legs: d.legs,
    ...Object.fromEntries(TIME_FIELDS.map(([key]) => [key, number(d.times[key])])),
    ...Object.fromEntries(LANDING_FIELDS.map(([key]) => [key, number(d.landings[key])])),
    notes: d.notes.trim() || undefined,
  }
}

// Zod's default messages are written for developers; these are for pilots.
export function friendlyMessage(issue: { path: PropertyKey[]; code: string; message: string }): string {
  const [field, , legField] = issue.path
  if (field === 'aircraftId') return 'Choose an aircraft'
  if (field === 'flightDate') return 'Enter the date of the flight'
  if (field === 'totalTime' && issue.code === 'too_small') return 'Enter the total time'
  if (field === 'legs' && legField) return 'Enter an airport code'
  if (issue.code === 'invalid_type') return 'Enter a number'
  if (issue.code === 'not_multiple_of') return 'Use tenths of an hour, like 1.3'
  return issue.message
}

// Airport lookups and leg distances for the legs being typed.
export function useLegDistances(legs: DraftLeg[]) {
  const airports = useAirports(legs.flatMap((leg) => [leg.origin, leg.destination]))
  const find = (ident: string) => airports.get(ident.trim().toUpperCase())
  const distances = legs.map((leg) => {
    const a = find(leg.origin)
    const b = find(leg.destination)
    return a && b ? distanceNm({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude }) : null
  })
  return { find, distances }
}
