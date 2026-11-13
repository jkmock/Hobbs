import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import '@fontsource-variable/archivo'
import '@fontsource/azeret-mono/400.css'
import '@fontsource/azeret-mono/500.css'
// Global styles before any component, so component CSS modules can override them.
import './index.css'
import { router } from './router'
import { installButtonPress } from './lib/buttonPress'
import { installNoZoom } from './lib/noZoom'
import { installStatusBar } from './lib/statusBar'

// Every button presses in on touch and springs back out on release.
installButtonPress()
// No pinch or keyboard zoom: the app stays at its own size, like a native one.
installNoZoom()
// The status bar's color follows the theme, live (and turns the map's color on map screens).
installStatusBar()

// Caches API responses. staleTime: reuse cached data for 30s before refetching.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
