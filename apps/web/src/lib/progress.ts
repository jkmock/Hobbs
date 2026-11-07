import type { Flight } from './types'

// Private pilot aeronautical experience, 14 CFR 61.109(a) (airplane single-engine).
// Phase 5 moves this into packages/shared with unit tests; it lives here until then.

export type Requirement = {
  label: string
  value: number
  target: number
  unit: 'hours' | 'count'
}

export type ProgressSection = {
  title: string
  items: Requirement[]
}

// Sum in tenths of an hour (integers) so 0.1 + 0.2 doesn't become 0.30000000000000004.
function sumHours(flights: Flight[], hours: (f: Flight) => number): number {
  return flights.reduce((tenths, f) => tenths + Math.round(hours(f) * 10), 0) / 10
}

function routeDistance(f: Flight): number {
  return f.legs.reduce((nm, leg) => nm + leg.distanceNm, 0)
}

// 61.109(a)(5)(ii): 150 nm total, full-stop landings at three points,
// one segment over 50 nm straight-line between takeoff and landing.
function isLongSoloCrossCountry(f: Flight): boolean {
  const airports = new Set(f.legs.flatMap((leg) => [leg.origin, leg.destination]))
  return (
    f.soloTime > 0 &&
    routeDistance(f) >= 150 &&
    airports.size >= 3 &&
    f.legs.some((leg) => leg.distanceNm > 50)
  )
}

// 61.109(a)(2)(i): one night cross-country over 100 nm total distance, with an instructor.
function isNightCrossCountry(f: Flight): boolean {
  return f.dualReceivedTime > 0 && f.nightTime > 0 && routeDistance(f) > 100
}

// The checkride prep hours must fall within the 2 calendar months before the test.
// With no test date yet, count the last 2 months.
function withinTwoMonths(isoDate: string): boolean {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 2)
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y!, m! - 1, d!) >= cutoff
}

export function privatePilotProgress(flights: Flight[]): { total: Requirement; sections: ProgressSection[] } {
  const dual = flights.filter((f) => f.dualReceivedTime > 0)
  const solo = flights.filter((f) => f.soloTime > 0)

  return {
    total: { label: 'Total time', value: sumHours(flights, (f) => f.totalTime), target: 40, unit: 'hours' },
    sections: [
      {
        title: 'With an instructor',
        items: [
          { label: 'Dual received', value: sumHours(dual, (f) => f.dualReceivedTime), target: 20, unit: 'hours' },
          {
            label: 'Cross-country',
            value: sumHours(dual, (f) => Math.min(f.crossCountryTime, f.dualReceivedTime)),
            target: 3,
            unit: 'hours',
          },
          {
            label: 'Night',
            value: sumHours(dual, (f) => Math.min(f.nightTime, f.dualReceivedTime)),
            target: 3,
            unit: 'hours',
          },
          {
            label: 'Instrument',
            value: sumHours(dual, (f) =>
              Math.min(f.actualInstrumentTime + f.simulatedInstrumentTime, f.dualReceivedTime),
            ),
            target: 3,
            unit: 'hours',
          },
          {
            label: 'Checkride prep',
            value: sumHours(dual.filter((f) => withinTwoMonths(f.flightDate)), (f) => f.dualReceivedTime),
            target: 3,
            unit: 'hours',
          },
          {
            label: 'Night full-stop landings',
            value: dual.reduce((n, f) => n + f.nightLandingsFs, 0),
            target: 10,
            unit: 'count',
          },
          {
            label: 'Night cross-country over 100 nm',
            value: dual.filter(isNightCrossCountry).length,
            target: 1,
            unit: 'count',
          },
        ],
      },
      {
        title: 'Solo',
        items: [
          { label: 'Solo time', value: sumHours(solo, (f) => f.soloTime), target: 10, unit: 'hours' },
          {
            label: 'Solo cross-country',
            value: sumHours(solo, (f) => Math.min(f.crossCountryTime, f.soloTime)),
            target: 5,
            unit: 'hours',
          },
          {
            label: '150 nm cross-country, 3 stops, one leg over 50 nm',
            value: solo.filter(isLongSoloCrossCountry).length,
            target: 1,
            unit: 'count',
          },
        ],
      },
    ],
  }
}

export function totals(flights: Flight[]) {
  return {
    flights: flights.length,
    hours: sumHours(flights, (f) => f.totalTime),
    distanceNm: Math.round(flights.reduce((nm, f) => nm + routeDistance(f), 0)),
  }
}
