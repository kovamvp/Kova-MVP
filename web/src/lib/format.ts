const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function inr(x?: number | null, opts: { compact?: boolean; sign?: boolean } = {}) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  const sign = opts.sign && x > 0 ? '+' : x < 0 ? '−' : ''
  const a = Math.abs(x)
  if (opts.compact !== false && a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2).replace(/\.00$/, '')} Cr`
  if (opts.compact !== false && a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')} L`
  return `${sign}₹${IN.format(a)}`
}
export const full = (x?: number | null) => (x === null || x === undefined ? '—' : `₹${IN.format(x)}`)
export const pct = (x?: number | null, d = 1) => (x === null || x === undefined ? '—' : `${x.toFixed(d)}%`)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const parse = (s: string) => new Date(s.length <= 10 ? s + 'T00:00' : s)
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function nowISO() {
  const d = new Date()
  return `${todayISO()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function daysFrom(s?: string | null) {
  if (!s) return null
  const a = parse(s.slice(0, 10)).getTime()
  const b = parse(todayISO()).getTime()
  return Math.round((a - b) / 86400000)
}
export function date(s?: string | null, withYear = false) {
  if (!s) return '—'
  const d = parse(s)
  return `${d.getDate()} ${MON[d.getMonth()]}${withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`
}
export function time(s?: string | null) {
  if (!s || s.length < 16) return ''
  const d = parse(s)
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}
export function dayName(s: string) { return DAY[parse(s).getDay()] }
export function when(s?: string | null) {
  if (!s) return '—'
  const n = daysFrom(s)!
  const t = s.length > 10 ? `, ${time(s)}` : ''
  if (n === 0) return `Today${t}`
  if (n === 1) return `Tomorrow${t}`
  if (n === -1) return `Yesterday${t}`
  if (n > 1 && n < 7) return `${dayName(s)} ${date(s)}${t}`
  return `${date(s)}${t}`
}
export function ago(s?: string | null) {
  if (!s) return '—'
  const n = -daysFrom(s)!
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 30) return `${n} days ago`
  if (n < 365) { const m = Math.round(n / 30); return m === 1 ? 'a month ago' : `${m} months ago` }
  return `${(n / 365).toFixed(1).replace(/\.0$/, '')} years ago`
}
export const initials = (name: string) => name.replace(/^(Dr\.|Mrs\.|Mr\.)\s+/, '').split(/\s+|&/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const label = (s: string) => cap(s.replace(/_/g, ' '))
