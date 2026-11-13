import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { POP_MS, POP_SCALE, PRESS_SCALE, pressIn, scaleOf, stopAnimations } from '../lib/press'
import styles from '../components/FlightList.module.css'

// How long the outgoing parts fade before the swap, and how long the card takes to move
// when there's no press and pop (reduced motion).
const FADE_MS = 110
const MOVE_MS = 350
// Opening a flight: the card presses in as you tap it (while the rest fades), glides up to
// the top still pressed in, and once in place pops (grows just past full size and settles).
// Then the flight's details pop in under it. Closing it (the X) is the same the other way:
// it presses in as the details fade, glides back down to its place in the list, and pops.
const GLIDE_MS = 340
const GLIDE_EASING = 'cubic-bezier(0.25, 0.1, 0.15, 1)' // gets going quickly, settles gently
const DETAILS_AFTER = 0.4 // the details start this far into the pop

export type PanelKind = 'props' | 'comments'

// A list of flight cards that is also each flight's page (My flights, and the social feed):
// the flight's page is the list showing just that flight's card, with its details under it,
// so the card you tap is the same element, live map and all, the whole time.
//
// Going in: the card presses in while the other cards and the header fade out, glides up to
// the top, and pops; the flight's header fades in and its details pop in after. Going back
// (the X): the card presses in while the details fade, glides back down to where it was in
// the list (scrolled as it was), and pops, while the other cards fade back in.
//
// `routeId` is the flight the URL shows (null for the list).
export function useCardExpand(routeId: string | null) {
  // The flight on show. It follows the URL, but only after the outgoing parts have faded.
  const [shownId, setShownId] = useState(routeId)
  const leaving = routeId !== shownId
  // The flight just closed: the rest of the list fades back in around its card (and not on
  // the list's first load).
  const [cameBackFrom, setCameBackFrom] = useState<string | null>(null)

  // A flight's props or comments, under its card's footer: on the flight's page, or right in
  // the list (one card at a time). Kept (with open false) after closing, so what was showing
  // can slide shut.
  const [panel, setPanel] = useState<{ id: string; kind: PanelKind; open: boolean } | null>(null)
  // The flight whose card has finished moving into place: a panel asked for as the flight
  // opens waits for this, so it opens under a card that's sitting still.
  const [settledId, setSettledId] = useState<string | null>(routeId)
  // Whether this card's panel is open. On the flight's page it waits for the card to settle,
  // and slides shut as soon as Back is pressed; in the list it opens straight away, and shuts
  // when a flight is opened.
  function panelOpenFor(id: string) {
    if (panel?.id !== id || !panel.open) return false
    if (shownId === null) return routeId === null
    return id === shownId && routeId === shownId && settledId === shownId
  }
  const panelOpen = shownId !== null && panelOpenFor(shownId)
  function togglePanel(id: string, kind: PanelKind) {
    setPanel((p) => ({ id, kind, open: !(p?.id === id && p.kind === kind && p.open) }))
  }

  const page = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLElement>())
  const listScroll = useRef(0) // where the list was scrolled, to come back to
  // The card to move, from where, and (opening a flight) how pressed in it is.
  const move = useRef<{ id: string; top: number; pressed: number | null } | null>(null)
  // When the details start popping in, after the card has slid up and popped.
  const [detailsDelay, setDetailsDelay] = useState(100)

  // Opening or closing a flight: its card presses in while the rest fades. (Opening, a tap
  // has usually pressed it already; this covers the keyboard and links.)
  useEffect(() => {
    if (!leaving) return
    const id = routeId ?? shownId
    const el = id ? cards.current.get(id) : undefined
    if (el) pressIn(el)
  }, [leaving, routeId, shownId])

  // After the fade, swap, noting where the card is now so it can slide from there.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      const id = routeId ?? shownId
      const el = id ? cards.current.get(id) : undefined
      // Where its unpressed outline is, and how pressed in it is now (it's scaled about its
      // middle, so its outline sits a little lower than its spot).
      const rect = el?.getBoundingClientRect()
      const scale = el ? scaleOf(el) : 1
      const top = rect ? rect.top - ((rect.height / scale) * (1 - scale)) / 2 : 0
      const pressed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      move.current = id && el ? { id, top, pressed: pressed ? scale : null } : null
      if (shownId === null && page.current) listScroll.current = page.current.scrollTop
      setCameBackFrom(routeId === null ? shownId : null)
      // Already sliding shut; a plain tap reopens the flight without it. Opening a different
      // flight than the one whose panel is open in the list shuts that one too.
      if (routeId === null || panel?.id !== routeId) setPanel((p) => (p ? { ...p, open: false } : p))
      setSettledId(null) // the card is about to move
      setShownId(routeId)
    }, FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving, routeId, shownId, panel?.id])

  // Right after the swap, before it's drawn: scroll to the top (or back to where the list
  // was), then move the card from its old spot to its new one. Opening a flight, it glides up
  // pressed in and then pops, all as one animation, and the details (whose start is set here)
  // follow.
  useLayoutEffect(() => {
    if (page.current) page.current.scrollTop = shownId ? 0 : listScroll.current
    const from = move.current
    move.current = null
    const el = from && cards.current.get(from.id)
    if (!from || !el) {
      setSettledId(shownId)
      return
    }
    // Settled once the move below finishes (or is cut short, by a press, say).
    const settle = (a: Animation) => {
      const done = () => setSettledId(shownId)
      a.finished.then(done, done)
    }
    stopAnimations(el) // the animation below picks up from the pressed-in size
    const dy = from.top - el.getBoundingClientRect().top
    const slides = Math.abs(dy) >= 1

    if (from.pressed === null) {
      if (slides) {
        settle(
          el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
            duration: MOVE_MS,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          }),
        )
      } else setSettledId(shownId)
      return
    }

    const glide = slides ? GLIDE_MS : 0
    const total = glide + POP_MS
    const atTop = glide / total // where the glide ends and the pop starts
    settle(
      el.animate(
        [
          { transform: `translateY(${dy}px) scale(${from.pressed})`, easing: GLIDE_EASING },
          { transform: `translateY(0px) scale(${PRESS_SCALE})`, offset: atTop, easing: 'ease-out' },
          { transform: `translateY(0px) scale(${POP_SCALE})`, offset: atTop + (1 - atTop) * 0.45, easing: 'ease-in-out' },
          { transform: 'translateY(0px) scale(1)' },
        ],
        { duration: total },
      ),
    )
    setDetailsDelay(glide + POP_MS * DETAILS_AFTER)
  }, [shownId])

  function cardRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) cards.current.set(id, el)
      else cards.current.delete(id)
    }
  }

  // The header and details: fading out ahead of a swap, or fading in after one (not on the
  // list's first load).
  const swapClass = leaving ? styles.fadeOut : shownId !== null || cameBackFrom !== null ? styles.fadeIn : ''
  // The cards other than the one moving: gone on a flight's page, fading on the way there.
  function otherClass(id: string) {
    if (shownId !== null) return id === shownId ? '' : styles.gone
    if (leaving && id !== routeId) return styles.fadeOut
    // The card coming back stays as it is; it never left the screen.
    return cameBackFrom !== null && id !== cameBackFrom ? styles.fadeIn : ''
  }

  return {
    shownId,
    leaving,
    cameBackFrom,
    page,
    cards,
    cardRef,
    detailsDelay,
    swapClass,
    otherClass,
    panel,
    panelOpen,
    panelOpenFor,
    // Whether this card's Props or Comments is the one open, for its footer button.
    isOpen: (id: string, kind: PanelKind) => panelOpenFor(id) && panel?.kind === kind,
    togglePanel,
    // The card with a panel (open, or sliding shut): the flight on show, the one coming back
    // to the list, or the one whose panel was opened in the list.
    hasPanel: (id: string) => id === shownId || id === cameBackFrom || panel?.id === id,
    fadeOut: styles.fadeOut,
  }
}
