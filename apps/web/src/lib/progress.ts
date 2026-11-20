import type { GoalId } from '@hobbs/shared'
import type { Aircraft, Flight } from './types'
import { distanceNm } from './geo'

// The Goal tab: the aeronautical experience each certificate or rating asks for, worked out
// from the pilot's logged flights (airplane, single-engine land unless noted).
// Phase 5 moves this into packages/shared with unit tests; it lives here until then.

export type Requirement = {
  // What it measures. Requirements that measure the same thing share a key across goals
  // (Total time, Solo time), so a pilot's adjustment to one (time logged before Hobbs) counts
  // in every goal that uses it.
  key: string
  label: string
  value: number
  target?: number // none for No Specific Goal's totals: just the number, no bar
  unit: 'hours' | 'count'
}

export type ProgressSection = {
  title: string
  items: Requirement[]
}

export type GoalProgress = { total: Requirement; sections: ProgressSection[] }

// Choices that change what a goal asks for.
export type GoalOptions = { atpRequiredHours: number } // ATP: 1500, or less for a restricted ATP

export type Goal = {
  id: GoalId
  title: string // "Private Pilot"
  subtitle: string // the regulation
  earns: string // what passing the checkride earns: "Private Pilot certificate"
  progress: (flights: Flight[], aircraft: Map<string, Aircraft>, options: GoalOptions) => GoalProgress
}

// --- Measuring flights ---

// Sum in tenths of an hour (integers) so 0.1 + 0.2 doesn't become 0.30000000000000004.
function sumHours(flights: Flight[], hours: (f: Flight) => number): number {
  return flights.reduce((tenths, f) => tenths + Math.round(hours(f) * 10), 0) / 10
}

function routeDistance(f: Flight): number {
  return f.legs.reduce((nm, leg) => nm + leg.distanceNm, 0)
}

// Every airport the flight landed at or took off from.
function airportCount(f: Flight): number {
  return new Set(f.legs.flatMap((leg) => [leg.origin, leg.destination])).size
}

// The farthest any landing was, in a straight line, from where the flight first took off.
function farthestFromStart(f: Flight): number {
  const start = f.legs[0]?.originPoint
  return start ? Math.max(0, ...f.legs.map((leg) => distanceNm(start, leg.destinationPoint))) : 0
}

// Checkride prep must fall within the 2 calendar months before the test. With no test date
// yet, count the last 2 months.
function withinTwoMonths(isoDate: string): boolean {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 2)
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y!, m! - 1, d!) >= cutoff
}

const instrument = (f: Flight) => f.actualInstrumentTime + f.simulatedInstrumentTime
const fullStops = (f: Flight) => f.dayLandingsFs + f.nightLandingsFs

const hours = (key: string, label: string, value: number, target?: number): Requirement => ({ key, label, value, target, unit: 'hours' })
const count = (key: string, label: string, value: number, target?: number): Requirement => ({ key, label, value, target, unit: 'count' })

// --- The goals ---

export const GOALS: Goal[] = [
  {
    // No Specific Goal: the logbook's totals, with nothing to reach. Keys are shared with the
    // goals that measure the same thing, so time set here carries over if a goal is picked later.
    id: 'none',
    title: 'No Specific Goal',
    subtitle: 'Your logbook totals',
    earns: '',
    progress: (flights) => ({
      total: hours('totalTime', 'Total time', sumHours(flights, (f) => f.totalTime)),
      sections: [
        {
          title: 'Time',
          items: [
            hours('picTime', 'PIC', sumHours(flights, (f) => f.picTime)),
            hours('sicTime', 'SIC', sumHours(flights, (f) => f.sicTime)),
            hours('dualReceived', 'Dual received', sumHours(flights, (f) => f.dualReceivedTime)),
            hours('soloTime', 'Solo', sumHours(flights, (f) => f.soloTime)),
            hours('crossCountryTime', 'Cross-country', sumHours(flights, (f) => f.crossCountryTime)),
            hours('nightTime', 'Night', sumHours(flights, (f) => f.nightTime)),
            hours('actualInstrument', 'Actual instrument', sumHours(flights, (f) => f.actualInstrumentTime)),
            hours('simulatedInstrument', 'Simulated instrument', sumHours(flights, (f) => f.simulatedInstrumentTime)),
          ],
        },
        {
          title: 'Landings and approaches',
          items: [
            count('dayFullStops', 'Day full-stop landings', flights.reduce((n, f) => n + f.dayLandingsFs, 0)),
            count('dayTouchAndGoes', 'Day touch-and-goes', flights.reduce((n, f) => n + f.dayLandingsTg, 0)),
            count('nightFullStops', 'Night full-stop landings', flights.reduce((n, f) => n + f.nightLandingsFs, 0)),
            count('nightTouchAndGoes', 'Night touch-and-goes', flights.reduce((n, f) => n + f.nightLandingsTg, 0)),
            count('instrumentApproaches', 'Instrument approaches', flights.reduce((n, f) => n + f.instrumentApproaches, 0)),
          ],
        },
      ],
    }),
  },
  {
    id: 'private',
    title: 'Private Pilot',
    subtitle: '14 CFR 61.109(a) · airplane single-engine',
    earns: 'Private Pilot certificate',
    progress: (flights) => {
      const dual = flights.filter((f) => f.dualReceivedTime > 0)
      const solo = flights.filter((f) => f.soloTime > 0)
      return {
        total: hours('totalTime', 'Total time', sumHours(flights, (f) => f.totalTime), 40),
        sections: [
          {
            title: 'With an instructor',
            items: [
              hours('dualReceived', 'Dual received', sumHours(dual, (f) => f.dualReceivedTime), 20),
              hours('dualCrossCountry', 'Cross-country', sumHours(dual, (f) => Math.min(f.crossCountryTime, f.dualReceivedTime)), 3),
              hours('dualNight', 'Night', sumHours(dual, (f) => Math.min(f.nightTime, f.dualReceivedTime)), 3),
              hours('dualInstrument', 'Instrument', sumHours(dual, (f) => Math.min(instrument(f), f.dualReceivedTime)), 3),
              hours('privateCheckridePrep', 'Checkride prep', sumHours(dual.filter((f) => withinTwoMonths(f.flightDate)), (f) => f.dualReceivedTime), 3),
              count('dualNightFullStops', 'Night full-stop landings', dual.reduce((n, f) => n + f.nightLandingsFs, 0), 10),
              count(
                'nightCrossCountry',
                'Night cross-country over 100 nm',
                // 61.109(a)(2)(i): one night cross-country over 100 nm total, with an instructor.
                dual.filter((f) => f.nightTime > 0 && routeDistance(f) > 100).length,
                1,
              ),
            ],
          },
          {
            title: 'Solo',
            items: [
              hours('soloTime', 'Solo time', sumHours(solo, (f) => f.soloTime), 10),
              hours('soloCrossCountry', 'Solo cross-country', sumHours(solo, (f) => Math.min(f.crossCountryTime, f.soloTime)), 5),
              count(
                'privateLongSoloCrossCountry',
                '150 nm cross-country, 3 stops, one leg over 50 nm',
                // 61.109(a)(5)(ii): 150 nm total, full-stop landings at three points, one
                // segment over 50 nm straight-line.
                solo.filter((f) => routeDistance(f) >= 150 && airportCount(f) >= 3 && f.legs.some((leg) => leg.distanceNm > 50)).length,
                1,
              ),
            ],
          },
        ],
      }
    },
  },
  {
    id: 'instrument',
    title: 'Instrument Rating',
    subtitle: '14 CFR 61.65(d) · airplane',
    earns: 'Instrument rating',
    progress: (flights) => {
      const dual = flights.filter((f) => f.dualReceivedTime > 0)
      return {
        total: hours('instrumentTime', 'Instrument time', sumHours(flights, instrument), 40),
        sections: [
          {
            title: 'Cross-country',
            items: [hours('picCrossCountry', 'Cross-country as PIC', sumHours(flights, (f) => Math.min(f.crossCountryTime, f.picTime)), 50)],
          },
          {
            title: 'With an instrument instructor',
            items: [
              hours('dualInstrument', 'Instrument training', sumHours(dual, (f) => Math.min(instrument(f), f.dualReceivedTime)), 15),
              hours(
                'instrumentCheckridePrep',
                'Checkride prep',
                sumHours(dual.filter((f) => withinTwoMonths(f.flightDate)), (f) => Math.min(instrument(f), f.dualReceivedTime)),
                3,
              ),
              count(
                'ifrCrossCountry',
                '250 nm IFR cross-country, 3 approaches',
                // 61.65(d)(2)(ii): 250 nm along airways or ATC routing, an instrument approach at
                // each airport, three different kinds of approach.
                dual.filter((f) => instrument(f) > 0 && routeDistance(f) >= 250 && f.instrumentApproaches >= 3).length,
                1,
              ),
            ],
          },
        ],
      }
    },
  },
  {
    id: 'commercial',
    title: 'Commercial Pilot',
    subtitle: '14 CFR 61.129(a) · airplane single-engine',
    earns: 'Commercial Pilot certificate',
    progress: (flights, aircraft) => {
      const dual = flights.filter((f) => f.dualReceivedTime > 0)
      const solo = flights.filter((f) => f.soloTime > 0)
      // 61.129(a)(3)(ii)–(iii): 2 hours or more, more than 100 nm straight-line from the start.
      const longTraining = dual.filter((f) => f.totalTime >= 2 && farthestFromStart(f) > 100)
      return {
        total: hours('totalTime', 'Total time', sumHours(flights, (f) => f.totalTime), 250),
        sections: [
          {
            title: 'Pilot in command',
            items: [
              hours('picTime', 'PIC time', sumHours(flights, (f) => f.picTime), 100),
              hours('picCrossCountry', 'Cross-country as PIC', sumHours(flights, (f) => Math.min(f.crossCountryTime, f.picTime)), 50),
            ],
          },
          {
            title: 'With an instructor',
            items: [
              hours('dualInstrument', 'Instrument training', sumHours(dual, (f) => Math.min(instrument(f), f.dualReceivedTime)), 10),
              hours(
                'complexTraining',
                'Complex or TAA training',
                sumHours(dual.filter((f) => aircraft.get(f.aircraftId)?.isComplex), (f) => f.dualReceivedTime),
                10,
              ),
              count('commercialDayCrossCountry', 'Day cross-country, 2 h, over 100 nm', longTraining.filter((f) => f.totalTime - f.nightTime >= 2).length, 1),
              count('commercialNightCrossCountry', 'Night cross-country, 2 h, over 100 nm', longTraining.filter((f) => f.nightTime >= 2).length, 1),
              hours('commercialCheckridePrep', 'Checkride prep', sumHours(dual.filter((f) => withinTwoMonths(f.flightDate)), (f) => f.dualReceivedTime), 3),
            ],
          },
          {
            title: 'Solo',
            items: [
              hours('soloTime', 'Solo time', sumHours(solo, (f) => f.soloTime), 10),
              count(
                'commercialLongCrossCountry',
                '300 nm cross-country, 3 stops, one over 250 nm',
                // 61.129(a)(4)(i): 300 nm total, landings at three points, one of them at least
                // 250 nm straight-line from the start.
                solo.filter((f) => routeDistance(f) >= 300 && airportCount(f) >= 3 && farthestFromStart(f) >= 250).length,
                1,
              ),
              hours('soloNight', 'Night', sumHours(solo, (f) => Math.min(f.nightTime, f.soloTime)), 5),
              count('soloNightLandings', 'Night takeoffs and landings', solo.reduce((n, f) => n + f.nightLandingsFs + f.nightLandingsTg, 0), 10),
            ],
          },
        ],
      }
    },
  },
  {
    id: 'multi',
    title: 'Multi-Engine Rating',
    subtitle: '14 CFR 61.63(c) · airplane multi-engine land',
    earns: 'Multi-engine rating',
    progress: (flights, aircraft) => {
      const multi = flights.filter((f) => aircraft.get(f.aircraftId)?.aircraftClass === 'multi_engine_land')
      const dual = multi.filter((f) => f.dualReceivedTime > 0)
      return {
        total: hours('multiDual', 'Multi-engine training', sumHours(dual, (f) => f.dualReceivedTime), 10),
        sections: [],
      }
    },
  },
  {
    id: 'atp',
    title: 'Airline Transport Pilot',
    subtitle: '14 CFR 61.159(a) · airplane',
    earns: 'Airline Transport Pilot certificate',
    progress: (flights, aircraft, options) => {
      // 61.159(a)(3): 50 hours in the class of airplane the certificate is for. Most ATPs are
      // multi-engine, so this counts multi-engine time.
      const multi = flights.filter((f) => aircraft.get(f.aircraftId)?.aircraftClass === 'multi_engine_land')
      return {
        total: hours('totalTime', 'Total time', sumHours(flights, (f) => f.totalTime), options.atpRequiredHours),
        sections: [
          {
            title: 'Flight time',
            items: [
              // A restricted ATP (fewer than 1500 hours, 61.160) asks for 200 hours of
              // cross-country in place of 500.
              hours('crossCountryTime', 'Cross-country', sumHours(flights, (f) => f.crossCountryTime), options.atpRequiredHours < 1500 ? 200 : 500),
              hours('nightTime', 'Night', sumHours(flights, (f) => f.nightTime), 100),
              hours('instrumentTime', 'Instrument', sumHours(flights, instrument), 75),
              hours('multiTime', 'Multi-engine', sumHours(multi, (f) => f.totalTime), 50),
            ],
          },
          {
            title: 'Pilot in command',
            items: [
              hours('picTime', 'PIC time', sumHours(flights, (f) => f.picTime), 250),
              hours('picCrossCountry', 'Cross-country as PIC', sumHours(flights, (f) => Math.min(f.crossCountryTime, f.picTime)), 100),
              hours('picNight', 'Night as PIC', sumHours(flights, (f) => Math.min(f.nightTime, f.picTime)), 25),
            ],
          },
        ],
      }
    },
  },
  {
    id: 'sport',
    title: 'Sport Pilot',
    subtitle: '14 CFR 61.313(a) · airplane',
    earns: 'Sport Pilot certificate',
    progress: (flights) => {
      const dual = flights.filter((f) => f.dualReceivedTime > 0)
      const solo = flights.filter((f) => f.soloTime > 0)
      return {
        total: hours('totalTime', 'Total time', sumHours(flights, (f) => f.totalTime), 20),
        sections: [
          {
            title: 'With an instructor',
            items: [
              hours('dualReceived', 'Dual received', sumHours(dual, (f) => f.dualReceivedTime), 15),
              hours('dualCrossCountry', 'Cross-country', sumHours(dual, (f) => Math.min(f.crossCountryTime, f.dualReceivedTime)), 2),
              hours('sportCheckridePrep', 'Checkride prep', sumHours(dual.filter((f) => withinTwoMonths(f.flightDate)), (f) => f.dualReceivedTime), 2),
            ],
          },
          {
            title: 'Solo',
            items: [
              hours('soloTime', 'Solo time', sumHours(solo, (f) => f.soloTime), 5),
              count(
                'sportSoloCrossCountry',
                '75 nm cross-country, 2 stops, one leg over 25 nm',
                // 61.313(a)(1)(iii): full-stop landings at two points (besides the start), one
                // segment at least 25 nm straight-line.
                solo.filter((f) => routeDistance(f) >= 75 && airportCount(f) >= 3 && f.legs.some((leg) => leg.distanceNm >= 25)).length,
                1,
              ),
            ],
          },
          {
            title: 'Landings',
            items: [count('fullStopLandings', 'Full-stop takeoffs and landings', flights.reduce((n, f) => n + fullStops(f), 0), 10)],
          },
        ],
      }
    },
  },
]

export const goalById = (id: GoalId) => GOALS.find((g) => g.id === id) ?? GOALS.find((g) => g.id === 'private')!

// Adds the pilot's adjustments (time logged before Hobbs) to what their flights add up to.
// Never below 0; hours stay in tenths.
export function adjusted(progress: GoalProgress, adjustments: Record<string, number>): GoalProgress {
  const apply = (r: Requirement): Requirement => ({ ...r, value: Math.max(0, Math.round((r.value + (adjustments[r.key] ?? 0)) * 10) / 10) })
  return { total: apply(progress.total), sections: progress.sections.map((s) => ({ ...s, items: s.items.map(apply) })) }
}

export function totals(flights: Flight[]) {
  return {
    flights: flights.length,
    hours: sumHours(flights, (f) => f.totalTime),
    distanceNm: Math.round(flights.reduce((nm, f) => nm + routeDistance(f), 0)),
  }
}
