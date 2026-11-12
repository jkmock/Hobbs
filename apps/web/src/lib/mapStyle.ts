import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'

// The two base maps a route can be drawn on.
//
// 'chart': our own vector map in FlightAware's live-map colors (deep blue water, steel-blue
//   land, pale blue borders). Only the colors are borrowed; the map data is OpenStreetMap's,
//   served free (no key) by OpenFreeMap in the OpenMapTiles layout.
// 'sectional': the FAA's VFR sectional charts (public-domain raster tiles).

export type BaseMap = 'chart' | 'sectional'

export const CHART_COLORS = {
  water: '#003366',
  land: '#285981',
  coast: '#537b9b',
  state: '#6587a4',
  country: '#85a1b9',
  road: '#3b6a94',
  county: '#4a7499', // between the land and the state lines, so counties read as the next level down
  runway: '#9db5c9',
  label: '#a9bfd2', // dimmer than our white airport labels, so the route reads first
  labelHalo: '#0d3a63',
  route: '#ffffff',
  routeCasing: '#002a55',
}

const SECTIONAL_TILES =
  'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}'

export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const FONT = ['Noto Sans Regular']
const FONT_BOLD = ['Noto Sans Bold']

export function baseSources(base: BaseMap): Record<string, SourceSpecification> {
  if (base === 'sectional') {
    return {
      base: {
        type: 'raster',
        tiles: [SECTIONAL_TILES],
        tileSize: 256,
        // The FAA only serves zoom 8-12; MapLibre stretches zoom 12 when zoomed in further.
        minzoom: 8,
        maxzoom: 12,
        attribution: 'Charts: FAA Aeronautical Information Services',
      },
    }
  }
  return {
    base: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution:
        '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  }
}

export function baseLayers(base: BaseMap): LayerSpecification[] {
  if (base === 'sectional') {
    return [
      { id: 'paper', type: 'background', paint: { 'background-color': '#e9e5d9' } },
      { id: 'sectional', type: 'raster', source: 'base' },
    ]
  }

  const c = CHART_COLORS
  return [
    { id: 'land', type: 'background', paint: { 'background-color': c.land } },
    { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': c.water } },
    {
      id: 'coast',
      type: 'line',
      source: 'base',
      'source-layer': 'water',
      paint: { 'line-color': c.coast, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1] },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'base',
      'source-layer': 'waterway',
      minzoom: 8,
      paint: { 'line-color': c.water, 'line-width': 1 },
    },
    {
      id: 'roads',
      type: 'line',
      source: 'base',
      'source-layer': 'transportation',
      // One zoom further out than the roads first appeared, so states don't go blank as soon.
      minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      paint: {
        'line-color': c.road,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 6, 0.5, 12, 2],
      },
    },
    {
      id: 'runways',
      type: 'line',
      source: 'base',
      'source-layer': 'aeroway',
      minzoom: 10,
      filter: ['==', ['get', 'class'], 'runway'],
      paint: { 'line-color': c.runway, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 8] },
    },
    // Counties: the level of detail after state lines, shown as soon as the tiles carry them.
    {
      id: 'counties',
      type: 'line',
      source: 'base',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.county, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 0.8] },
    },
    {
      id: 'states',
      type: 'line',
      source: 'base',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.state, 'line-width': 0.8 },
    },
    {
      id: 'countries',
      type: 'line',
      source: 'base',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.country, 'line-width': 1.3 },
    },
    {
      id: 'state-names',
      type: 'symbol',
      source: 'base',
      'source-layer': 'place',
      minzoom: 4,
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': ['get', 'name_en'],
        'text-font': FONT,
        'text-size': 11,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
      },
      paint: { 'text-color': c.country, 'text-halo-color': c.labelHalo, 'text-halo-width': 1 },
    },
    {
      id: 'towns',
      type: 'symbol',
      source: 'base',
      'source-layer': 'place',
      minzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 11 },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'cities',
      type: 'symbol',
      source: 'base',
      'source-layer': 'place',
      minzoom: 5,
      filter: ['==', ['get', 'class'], 'city'],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT_BOLD, 'text-size': 12 },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
    },
  ]
}

// The route on top of either base map: a dark casing under a white line on the blue chart,
// a white casing under a navy line on the paper sectional.
export function routeLayers(base: BaseMap, navy: string): LayerSpecification[] {
  const [line, casing] = base === 'chart' ? [CHART_COLORS.route, CHART_COLORS.routeCasing] : [navy, '#ffffff']
  return [
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': casing, 'line-width': 5.5 },
    },
    {
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': line, 'line-width': 2.5 },
    },
  ]
}
