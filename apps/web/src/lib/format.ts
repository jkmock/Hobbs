export function formatHours(hours: number): string {
  return hours.toFixed(1)
}

// "2026-11-04" -> "Nov 4" (this year) or "Nov 4, 2025".
// Parsed by hand: new Date("2026-11-04") is UTC midnight, which is the previous day in the US.
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// How long ago something happened, short: "now", "5m", "3h", "2d", then the date ("Nov 3").
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
