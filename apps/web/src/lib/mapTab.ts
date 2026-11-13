// The Map tab's map, shared by MapPage and MapPreloader (which builds it ahead of a visit).

// Room around the routes when the map frames them, clear of the panels floating over it.
// Routes are framed clear of the title card (top) and the floating tab bar (bottom).
export const MAP_TAB_FIT_PADDING = { top: 166, bottom: 140, left: 40, right: 72 }

// The slot the map is kept alive in between visits (lib/mapPool).
export const MAP_TAB_SLOT = 'map-tab'
