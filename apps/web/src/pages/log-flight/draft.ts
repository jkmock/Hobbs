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

// time: flight time in hours, as typed ('' = not entered). faFlightId: imported from FlightAware.
export type DraftLeg = { origin: string; destination: string; time: string; faFlightId?: string }

export type Draft = {
  aircraftId: string
  tailNumber: string // for display; the API only needs aircraftId
  flightDate: string
  instructorId: string // '' = no instructor
  legs: DraftLeg[]
  times: Record<TimeField, string>
  totalFromLegs: boolean // total time follows the sum of the leg times until the pilot changes it
  // The Solo/Dual shortcut that's selected. While set, solo/dual (and PIC for solo) follow the
  // total time; editing any of those by hand clears it.
  flightType: FlightType | null
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

export const emptyLeg = (patch: Partial<DraftLeg> = {}): DraftLeg => ({ origin: '', destination: '', time: '', ...patch })

// Sum of leg times, rounded to tenths (floating point would give 2.4000000000000004).
export function legTotal(times: number[]): number {
  return Math.round(times.reduce((sum, t) => sum + t, 0) * 10) / 10
}

export const draftLegTotal = (legs: DraftLeg[]) => legTotal(legs.map((l) => Number(l.time) || 0))

// Every change to the draft goes through here. While totalFromLegs is on, editing leg times
// updates the total; typing a different total by hand turns it off.
export function applyPatch(d: Draft, patch: Partial<Draft>): Draft {
  const next = { ...d, ...patch }
  const sum = draftLegTotal(next.legs)

  if (patch.times && patch.times.totalTime !== d.times.totalTime) {
    next.totalFromLegs = Number(patch.times.totalTime) === sum && sum > 0
  } else if (patch.legs && next.totalFromLegs && sum > 0) {
    next.times = { ...next.times, totalTime: sum.toFixed(1) }
  }

  // Typing in Dual, Solo or PIC yourself turns the shortcut off.
  if (patch.times && !('flightType' in patch)) {
    const handEdited = (['dualReceivedTime', 'soloTime', 'picTime'] as const).some(
      (key) => patch.times![key] !== d.times[key],
    )
    if (handEdited) next.flightType = null
  }
  // Otherwise the selected shortcut keeps its times matching the total.
  if (next.flightType) next.times = fillFromTotal(next.times, next.flightType)
  return next
}

export type FlightType = 'solo' | 'dual'

// Most training flights are all solo or all dual. Solo is also PIC. Dual never adds PIC; it
// only takes back PIC that matched solo (what Solo filled in), so PIC typed by hand stays.
function fillFromTotal(t: Draft['times'], type: FlightType): Draft['times'] {
  if (type === 'solo') return { ...t, soloTime: t.totalTime, picTime: t.totalTime, dualReceivedTime: '0.0' }
  return {
    ...t,
    dualReceivedTime: t.totalTime,
    soloTime: '0.0',
    picTime: t.picTime === t.soloTime ? '0.0' : t.picTime,
  }
}

// For a saved flight: which shortcut its times look like, if either.
function flightTypeOf(t: Draft['times']): FlightType | null {
  const dual = Number(t.dualReceivedTime) > 0
  const solo = Number(t.soloTime) > 0
  return dual && !solo ? 'dual' : solo && !dual ? 'solo' : null
}

export function emptyDraft(): Draft {
  return {
    aircraftId: '',
    tailNumber: '',
    flightDate: todayIso(),
    instructorId: '',
    legs: [emptyLeg()],
    times: mapFields(TIME_FIELDS, () => '0.0'),
    totalFromLegs: true,
    flightType: null, // neither Solo nor Dual Received until the pilot picks one
    landings: mapFields(LANDING_FIELDS, () => '0'),
    notes: '',
  }
}

export function draftFromFlight(f: Flight): Draft {
  const times = mapFields(TIME_FIELDS, (key) => f[key].toFixed(1))
  return {
    aircraftId: f.aircraftId,
    tailNumber: f.tailNumber,
    flightDate: f.flightDate,
    instructorId: f.instructorId ?? '',
    legs: f.legs.map(({ origin, destination, faFlightId, time }) => ({
      origin,
      destination,
      time: time != null ? time.toFixed(1) : '',
      faFlightId: faFlightId ?? undefined,
    })),
    times,
    // Keep following the legs only if the saved total still matches them.
    totalFromLegs: f.legs.every((l) => l.time != null) && legTotal(f.legs.map((l) => l.time ?? 0)) === f.totalTime,
    flightType: flightTypeOf(times),
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
    legs: d.legs.map((leg) => ({
      origin: leg.origin,
      destination: leg.destination,
      faFlightId: leg.faFlightId,
      time: number(leg.time),
    })),
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
  if (field === 'legs' && legField === 'time') return issue.code === 'invalid_type' ? 'Enter a number' : 'Use tenths of an hour, like 1.3'
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
