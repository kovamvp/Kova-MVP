const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/* Number style from Preferences: lakh and crore (default) or full figures. Read once, changed by setNumberStyle. */
let FULL = (() => { try { return JSON.parse(localStorage.getItem('kova.prefs') || '{}').numbers === 'full' } catch { return false } })()
export function setNumberStyle(style: 'lakh-crore' | 'full') { FULL = style === 'full' }

/* compact (default): headlines and widgets, trailing zeros dropped (₹2 Cr, ₹1.5 L).
   fixed: tables and lists, so digits line up (₹2.00 Cr, ₹95.0 L). */
export function inr(x?: number | null, opts: { compact?: boolean; sign?: boolean; fixed?: boolean } = {}) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  const sign = opts.sign && x > 0 ? '+' : x < 0 ? '−' : ''
  const a = Math.abs(x)
  const compact = opts.compact !== false && !FULL
  if (compact && a >= 1e7) { const v = (a / 1e7).toFixed(a >= 1e9 ? 0 : 2); return `${sign}₹${opts.fixed ? v : v.replace(/\.00$/, '')} Cr` }
  if (compact && a >= 1e5) { const v = (a / 1e5).toFixed(1); return `${sign}₹${opts.fixed ? v : v.replace(/\.0$/, '')} L` }
  return `${sign}₹${IN.format(a)}`
}
/* Indian digit grouping for amount inputs (75,00,000) and back */
export const groupIN = (x?: number | null) => (x === null || x === undefined || Number.isNaN(x) ? '' : IN.format(Math.round(x)))
export const parseAmount = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0
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
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
/* ISO dates that arrive inside text from the server ("Meeting · 2026-10-27") read as "27 Oct" */
export const datesInText = (t?: string | null) => (t || '').replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => date(m))
/* "Referral" + "Amit Kapadia (client)" reads as "Referral from Amit Kapadia, a client" */
export function sourceText(source?: string | null, detail?: string | null) {
  if (!detail) return source || ''
  const m = detail.match(/^(.*?)\s*\((client|prospect|partner)\)$/i)
  if (m) return `${source} from ${m[1]}, a ${m[2].toLowerCase()}`
  return `${source}: ${detail}`
}
/* "8 months ago" reads as "in 8 months" after "hasn't heard from you" */
export const sinceText = (s?: string | null) => { const a = ago(s); return a.endsWith(' ago') ? `in ${a.slice(0, -4).replace(/^a /, 'a ')}` : `since ${a}` }
export const stripTitle = (name: string) => name.replace(/^(Dr\.|Mrs\.|Mr\.|Ms\.)\s+/, '')
