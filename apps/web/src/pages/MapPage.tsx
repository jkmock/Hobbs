import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LazyFlightMap as FlightMap } from '../components/LazyFlightMap'
import { Link } from 'react-router'
import { Check, SlidersHorizontal } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Segmented } from '../components/controls'
import { useAllFlights } from '../hooks/useFlights'
import { useMyAircraft } from '../hooks/useLookups'
import { todayIso } from '../lib/format'
import { MAP_TAB_FIT_PADDING, MAP_TAB_SLOT } from '../lib/mapTab'
import { CHART_COLORS } from '../lib/mapStyle'
import { useStatusBarColor } from '../lib/statusBar'
import { useTabActive } from '../lib/tabActive'
import type { Aircraft, Flight } from '../lib/types'
import listStyles from '../components/FlightList.module.css'
import styles from './MapPage.module.css'



type Range = '1m' | '3m' | '6m' | '1y' | 'all'
const RANGES: { value: Range; label: string; months: number | null }[] = [
  { value: '1m', label: '1M', months: 1 },
  { value: '3m', label: '3M', months: 3 },
  { value: '6m', label: '6M', months: 6 },
  { value: '1y', label: '1Y', months: 12 },
  { value: 'all', label: 'All', months: null },
]

// Conditions a flight can be filtered by. Selecting several shows flights with all of them.
type Condition = 'xc' | 'night' | 'instrument' | 'solo' | 'dual'
const CONDITIONS: { value: Condition; label: string; test: (f: Flight) => boolean }[] = [
  { value: 'xc', label: 'Cross-country', test: (f) => f.crossCountryTime > 0 },
  { value: 'night', label: 'Night', test: (f) => f.nightTime > 0 },
  { value: 'instrument', label: 'Instrument', test: (f) => f.actualInstrumentTime + f.simulatedInstrumentTime > 0 },
  { value: 'solo', label: 'Solo', test: (f) => f.soloTime > 0 },
  { value: 'dual', label: 'Dual', test: (f) => f.dualReceivedTime > 0 },
]

type Filters = { range: Range; types: string[]; tails: string[]; conditions: Condition[] }
const NO_FILTERS: Filters = { range: 'all', types: [], tails: [], conditions: [] }

export default function MapPage() {
  const { data: flights = [], isPending } = useAllFlights()
  const { data: aircraft = [] } = useMyAircraft()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  const byId = useMemo(() => new Map(aircraft.map((a) => [a.id, a])), [aircraft])
  const typeOf = useCallback((f: Flight) => aircraftType(byId.get(f.aircraftId)) ?? f.tailNumber, [byId])

  // Options, counted over every flight, most flown first.
  const typeOptions = useMemo(() => countBy(flights, typeOf), [flights, typeOf])
  const tailOptions = useMemo(() => countBy(flights, (f) => f.tailNumber), [flights])

  const shown = useMemo(() => {
    const months = RANGES.find((r) => r.value === filters.range)?.months ?? null
    const since = months === null ? null : monthsAgoIso(months)
    return flights.filter(
      (f) =>
        (since === null || f.flightDate >= since) &&
        (filters.types.length === 0 || filters.types.includes(typeOf(f))) &&
        (filters.tails.length === 0 || filters.tails.includes(f.tailNumber)) &&
        filters.conditions.every((c) => CONDITIONS.find((x) => x.value === c)!.test(f)),
    )
  }, [flights, filters, typeOf])

  // Memoized so the map isn't redrawn on every render.
  const legs = useMemo(() => shown.flatMap((f) => f.legs), [shown])

  // Filters beyond the time range, counted on the Filters button.
  const extra = filters.types.length + filters.tails.length + filters.conditions.length
  const filtered = extra > 0 || filters.range !== 'all'
  const toggle = <K extends 'types' | 'tails' | 'conditions'>(key: K, value: Filters[K][number]) =>
    setFilters((f) => {
      const list = f[key] as string[]
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] }
    })

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  // The status bar turns the map's color while the map is showing (this page stays mounted,
  // hidden, while another tab is open, so it checks it's the tab on screen).
  const onScreen = useTabActive()
  useStatusBarColor(onScreen && !isPending && flights.length > 0 ? CHART_COLORS.land : null)

  if (isPending || flights.length === 0) {
    return (
      <>
        <PageHeader title="Map" className={listStyles.topHeader} />
        <div className="page">
          {isPending ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="empty">
              <p>Your routes will be drawn here.</p>
              <Link to="/flights/new" className="btn btn--primary">
                Log a flight
              </Link>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className={styles.screen}>
      <Suspense fallback={<div className={styles.mapFallback} />}>
        {/* Kept alive between visits, and built ahead by MapPreloader, so the tab opens on a drawn map. */}
        <FlightMap
          legs={legs}
          interactive
          className={styles.map}
          fitPadding={MAP_TAB_FIT_PADDING}
          keepViewWhenEmpty
          keepAs={MAP_TAB_SLOT}
        />
      </Suspense>

      {/* While the filters are open, tapping the map closes them. */}
      {sheetOpen && <div className={styles.scrim} onClick={() => setSheetOpen(false)} aria-hidden />}

      <header className={`card ${styles.panel} ${styles.top}`} data-open={sheetOpen || undefined}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Map</h1>
          <button
            type="button"
            className={`btn ${extra > 0 ? 'btn--primary' : ''} ${styles.filterBtn}`}
            onClick={() => setSheetOpen((open) => !open)}
            aria-expanded={sheetOpen}
            aria-controls="map-filters"
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
            Filters
            {extra > 0 && <span className={`mono ${styles.badge}`}>{extra}</span>}
          </button>
        </div>
        <Segmented
          label="Time range"
          options={RANGES}
          value={filters.range}
          onChange={(range) => setFilters((f) => ({ ...f, range }))}
        />

        {/* The filters, part of this card: they unfold down out of it, and fold back up. */}
        <div className={styles.filtersFold} id="map-filters" role="region" aria-label="Filters" inert={!sheetOpen}>
          <div className={styles.filters}>
          <div className={styles.sheetBody}>
            {typeOptions.length > 0 && (
              <FilterGroup title="Aircraft type">
                {typeOptions.map(([type]) => (
                  <Chip key={type} on={filters.types.includes(type)} onClick={() => toggle('types', type)}>
                    {type}
                  </Chip>
                ))}
              </FilterGroup>
            )}

            {tailOptions.length > 0 && (
              <FilterGroup title="Tail number">
                {tailOptions.map(([tail]) => (
                  <Chip key={tail} on={filters.tails.includes(tail)} onClick={() => toggle('tails', tail)}>
                    <span className="tail-number">{tail}</span>
                  </Chip>
                ))}
              </FilterGroup>
            )}

            <FilterGroup title="Flight conditions">
              {CONDITIONS.map((c) => (
                <Chip
                  key={c.value}
                  on={filters.conditions.includes(c.value)}
                  onClick={() => toggle('conditions', c.value)}
                >
                  {c.label}
                </Chip>
              ))}
            </FilterGroup>
          </div>
          <div className={styles.sheetFoot}>
            <button type="button" className="btn" onClick={() => setFilters(NO_FILTERS)} disabled={!filtered}>
              Reset
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setSheetOpen(false)}>
              Show {shown.length} {shown.length === 1 ? 'flight' : 'flights'}
            </button>
          </div>
          </div>
        </div>
      </header>

      {legs.length === 0 && !sheetOpen && (
        <div className={`card ${styles.panel} ${styles.bottom} ${styles.none}`}>
          <span className="muted">No routes match these filters.</span>
          <button type="button" className="btn btn--sm" onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend>{title}:</legend>
      <div className={styles.chips}>{children}</div>
    </fieldset>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={on} onClick={onClick}>
      {on && <Check size={14} strokeWidth={2.5} aria-hidden />}
      {children}
    </button>
  )
}

// "Cessna 172S", or null when the aircraft isn't known.
function aircraftType(a: Aircraft | undefined): string | null {
  if (!a) return null
  const name = `${a.make} ${a.model}`.trim()
  return name || null
}

// [value, count] pairs, most common first.
function countBy(flights: Flight[], key: (f: Flight) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const f of flights) counts.set(key(f), (counts.get(key(f)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

// The date `months` months before today, as YYYY-MM-DD (compared as a string with flightDate).
function monthsAgoIso(months: number): string {
  const [y, m, d] = todayIso().split('-').map(Number)
  const date = new Date(y!, m! - 1 - months, d!)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
