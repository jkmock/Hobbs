import { createContext, useContext } from 'react'

// Whether the page this is in is the one on screen. A kept tab page (components/KeptTabs) stays
// mounted, hidden, while another tab is open, and still sees the location it was last at, so
// it can't tell from the URL. Pages outside the kept tabs are always on screen.
export const TabActiveContext = createContext(true)

export const useTabActive = () => useContext(TabActiveContext)
