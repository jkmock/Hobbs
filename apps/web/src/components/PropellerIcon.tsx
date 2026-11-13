import type { SVGProps } from 'react'

// The Props icon: a three-bladed propeller, drawn for Hobbs on Lucide's 24px grid so it sits
// with the other icons (round line joins). Outline by default, a little lighter than Lucide's
// stroke; `filled` fills the same shape in (props given), so it never changes size or outline
// between the two.

// The hub, a whole circle at (0, 0), and three blades attached to it, each the same width from
// the hub out to its round tip (one blade turned to 0°, 120° and 240°). A blade's outline starts
// and ends on the hub, so the hub's circle runs unbroken across where the blades join. Filled,
// hub and blades fill together as one shape.
const PROPELLER =
  'M3.0 0A3.0 3.0 0 1 0 -3.0 0A3.0 3.0 0 1 0 3.0 0ZM-1.450 -2.626L-1.450 -9.400A1.45 1.45 0 0 1 1.450 -9.400L1.450 -2.626M2.999 0.057L8.866 3.444A1.45 1.45 0 0 1 7.416 5.956L1.549 2.569M-1.549 2.569L-7.416 5.956A1.45 1.45 0 0 1 -8.866 3.444L-2.999 0.057'
// Scaled up a little to fill the grid about as fully as Lucide's icons (the star it replaced);
// the stroke is divided by the same amount so it draws at the width asked for.
const SCALE = 1.08
// Where the hub is drawn (see below), so the icon turns about its hub when it spins.
const HUB_Y = 13.27

type Props = Omit<SVGProps<SVGSVGElement>, 'fill'> & { size?: number; strokeWidth?: number; filled?: boolean }

export default function PropellerIcon({ size = 24, strokeWidth = 1.25, filled = false, style, ...rest }: Props) {
  return (
    // The hub sits a little below the middle of the box: halfway between centering the whole
    // shape (which looks low beside text, the eye reading the hub as its middle) and centering
    // the hub (which looks high, one blade reaching up and two down).
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transformOrigin: `50% ${(HUB_Y / 24) * 100}%`, ...style }}
      {...rest}
    >
      <g
        transform={`translate(12 ${HUB_Y}) scale(${SCALE})`}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={strokeWidth / SCALE}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={PROPELLER} />
      </g>
    </svg>
  )
}
