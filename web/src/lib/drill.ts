/* Drill-down for analysis cards: group the book at one level (asset class, product type, subcategory,
   product, client), go one level deeper at a time, and compare each line with an earlier point.
   "Now" comes from current holdings; the earlier point comes from each client's monthly history. */

export type Level = 'asset_class' | 'product_type' | 'subcategory' | 'product' | 'client'
export type Period = 'month' | 'quarter' | 'fy'
export type Step = { level: Level; key: string; label: string }
export type Row = {
  key: string; label: string; level: Level; value: number; share: number; clients: number
  prev?: number; pct?: number; next?: Level
}

export const LEVEL_NAME: Record<Level, string> = {
  asset_class: 'asset class', product_type: 'product type', subcategory: 'category', product: 'product', client: 'client',
}
export const PERIODS: { key: Period; label: string; long: string }[] = [
  { key: 'month', label: 'Month', long: 'this month' },
  { key: 'quarter', label: 'Quarter', long: 'the last three months' },
  { key: 'fy', label: 'FY', long: 'this fiscal year' },
]

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shift = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number)
  const t = y * 12 + (mo - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
/* 1 April of the fiscal year a month falls in, as 'YYYY-04' */
export const fyStart = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return `${mo >= 4 ? y : y - 1}-04`
}

/* The month to compare against: a month back, three months back, or the end of the last fiscal year (March). */
export function comparePoint(months: string[], period: Period): string | undefined {
  if (!months.length) return undefined
  const last = months[months.length - 1]
  const target = period === 'month' ? shift(last, -1) : period === 'quarter' ? shift(last, -3) : shift(fyStart(last), -1)
  return months.includes(target) ? target : undefined
}

export function pointLabel(m: string, period: Period) {
  const [y, mo] = m.split('-').map(Number)
  if (period === 'fy') return `since 31 ${MON[mo - 1]} ${y}`
  return `since end of ${MON[mo - 1]}`
}

type Prod = { id: string; name: string; asset_class?: string | null; product_type?: string; subcategory?: string; category?: string; sub_category?: string }
const attr = (p: Prod | undefined, level: Level, pid: string): [string, string] => {
  if (level === 'product') return [pid, p?.name || pid]
  const v = level === 'asset_class' ? p?.asset_class : level === 'product_type' ? p?.product_type || p?.category : p?.subcategory || p?.sub_category
  const s = v || 'Other'
  return [s, s]
}

/* Group the book at the next level below `path`, using `levels` as the order of levels. */
export function drill(clients: any[], products: Prod[], path: Step[], levels: Level[], period: Period) {
  const level = levels[Math.min(path.length, levels.length - 1)]
  const next = levels[levels.indexOf(level) + 1]
  const pmap = new Map(products.map((p) => [p.id, p]))
  const months = [...new Set(clients.flatMap((c) => (c.history || []).map((h: any) => h.month as string)))].sort()
  const at = comparePoint(months, period)

  const fits = (c: any, pid: string) => path.every((s) => s.level === 'client' ? c.id === s.key : attr(pmap.get(pid), s.level, pid)[0] === s.key)
  const rows = new Map<string, Row & { who: Set<string> }>()
  const row = (k: string, label: string) => {
    if (!rows.has(k)) rows.set(k, { key: k, label, level, value: 0, share: 0, clients: 0, prev: at ? 0 : undefined, next, who: new Set() })
    return rows.get(k)!
  }
  const keyOf = (c: any, pid: string): [string, string] => level === 'client' ? [c.id, c.name] : attr(pmap.get(pid), level, pid)

  for (const c of clients) {
    for (const h of c.holdings || []) {
      if (!h.value || !fits(c, h.product_id)) continue
      const r = row(...keyOf(c, h.product_id))
      r.value += h.value
      r.who.add(c.id)
    }
    if (!at) continue
    const then = (c.history || []).find((h: any) => h.month === at)
    for (const [pid, v] of Object.entries((then?.by_product || {}) as Record<string, number>)) {
      if (!v || !fits(c, pid)) continue
      const r = row(...keyOf(c, pid))
      r.prev = (r.prev || 0) + v
    }
  }
  const all = [...rows.values()].filter((r) => r.value > 0 || (r.prev || 0) > 0)
  const total = all.reduce((a, r) => a + r.value, 0)
  const prevTotal = at ? all.reduce((a, r) => a + (r.prev || 0), 0) : undefined
  const out: Row[] = all.map(({ who, ...r }) => ({
    ...r, clients: who.size, share: total ? r.value / total : 0,
    pct: r.prev ? ((r.value - r.prev) / r.prev) * 100 : undefined,
  })).sort((a, b) => b.value - a.value)
  return { level, rows: out, total, prevTotal, at }
}

/* Revenue this fiscal year so far, and the same months of the year before. */
export function revenueSoFar(months: { month: string; revenue: number }[]) {
  if (!months.length) return { now: 0, before: 0, from: '' }
  const last = months[months.length - 1].month
  const from = fyStart(last)
  const sum = (a: string, b: string) => months.filter((m) => m.month >= a && m.month <= b).reduce((s, m) => s + (m.revenue || 0), 0)
  return { now: sum(from, last), before: sum(shift(from, -12), shift(last, -12)), from }
}
