import { useApi } from './api'

export const useClients = () => useApi<any[]>('/c/clients')
export const useProspects = () => useApi<any[]>('/c/prospects')
export const useProducts = () => useApi<any[]>('/c/products')
export const usePortfolios = () => useApi<any[]>('/c/portfolios')
export const useModels = () => useApi<any[]>('/c/model_portfolios')
export const useMeetings = () => useApi<any[]>('/c/meetings')
export const useRequests = (poll?: number) => useApi<any[]>('/c/requests', { poll })
export const useUpdates = () => useApi<any[]>('/c/updates')
export const useLd = () => useApi<any[]>('/c/ld_progress')
export const useGrowth = () => useApi<any>('/s/growth')
export const useRm = () => useApi<any>('/s/rm')
export const useResearch = () => useApi<any[]>('/c/research')
export const useFamilies = () => useApi<any[]>('/c/families')

export const SEGMENTS = [
  { key: 'active', label: 'Active', color: '#1D3A2E', rule: 'Transacted in the last 6 months' },
  { key: 'engaged', label: 'Engaged', color: '#6E8F7C', rule: 'In touch, no transaction in 6 months' },
  { key: 'dormant', label: 'Dormant', color: '#C9A961', rule: 'No contact or transaction in 6 months' },
  { key: 'lost', label: 'Lost', color: '#A4573A', rule: 'Fully redeemed or moved away' },
]
/* Client tiers by household value; thresholds live in backend/tiers.py (the server stamps c.tier). Keep labels in sync. */
export const TIERS = [
  { key: 'rise', label: 'Rise', level: 1, rule: 'Household assets with Kova below ₹5 Cr' },
  { key: 'ascent', label: 'Ascent', level: 2, rule: 'Household assets with Kova of ₹5 Cr to ₹10 Cr' },
  { key: 'summit', label: 'Summit', level: 3, rule: 'Household assets with Kova of ₹10 Cr to ₹20 Cr' },
  { key: 'zenith', label: 'Zenith', level: 4, rule: 'Household assets with Kova of ₹20 Cr and above' },
]
export const tierOf = (key?: string | null) => TIERS.find((t) => t.key === key)
export const SERVICE_CATEGORIES = ['Demographic update', 'Family details update', 'Nominee update', 'Bank account change', 'KYC re-verification',
  'Statement or certificate', 'Transaction issue', 'SIP or STP change', 'Other'] // same list as backend/profile.py
export const STAGES = ['Lead', 'Prospect', 'Registered', 'KYC in progress', 'Investing client', 'Investing and trading client']
export const STAGE_INFO: Record<string, string> = {
  Lead: 'Name and context only; not yet qualified',
  Prospect: 'Qualified; needs and investable surplus captured',
  Registered: 'Mobile and email verified; can browse Kova Client',
  'KYC in progress': 'PAN, KYC, bank, FATCA, nominee, risk profile underway',
  'Investing client': 'Can invest in mutual funds, bonds and FDs',
  'Investing and trading client': 'Demat, trading, exchange registration and DDPI done',
  Closed: 'Lost or paused; kept on record and can be reopened',
}
export const RISK_ORDER = ['Conservative', 'Moderately conservative', 'Moderate', 'Moderately aggressive', 'Aggressive']
export const PRODUCT_RISK: Record<string, number> = { Low: 0, 'Low to moderate': 1, Moderate: 2, 'Moderately high': 3, High: 3, 'Very high': 4, '—': 2 }
export const EQUITY_BAND: Record<string, [number, number]> = {
  Conservative: [0, 25], 'Moderately conservative': [15, 40], Moderate: [35, 60], 'Moderately aggressive': [50, 75], Aggressive: [65, 95],
}

export function assetClassOf(p: any): string {
  if (!p) return 'Equity'
  if (p.asset_class) return p.asset_class // the shared product classification, when the product has it
  if (p.sub_category?.startsWith('Commodity') || p.id === 'PD-601') return 'Gold'
  if (['PD-109', 'PD-110'].includes(p.id)) return 'Cash'
  if (['Bond', 'Fixed deposit'].includes(p.category) || p.sub_category?.startsWith('Debt') || p.id === 'PD-301') return 'Debt'
  if (p.category === 'Credit') return 'Cash'
  return 'Equity'
}

/* illustrative 12-month history for the book, derived deterministically from today's value */
export function bookHistory(now: number) {
  const months: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(m.toLocaleDateString('en-IN', { month: 'short' }))
  }
  const shape = [0.78, 0.8, 0.79, 0.83, 0.86, 0.85, 0.88, 0.9, 0.93, 0.92, 0.96, 1]
  return { labels: months, values: shape.map((s) => Math.round(now * s)) }
}

export function ldStats(products: any[] = [], ld: any[] = []) {
  const map = Object.fromEntries(ld.map((r) => [r.product_id, r.completed]))
  let done = 0, started = 0
  const per = products.map((p) => {
    const total = p.ld?.modules?.length || 1
    const c = (map[p.id] || []).filter((m: string) => p.ld.modules.some((x: any) => x.id === m)).length
    if (c >= total) done++
    else if (c > 0) started++
    return { id: p.id, name: p.name, total, completed: c, pct: Math.round((c / total) * 100) }
  })
  return { per, done, started, notStarted: products.length - done - started, overall: Math.round(per.reduce((a, x) => a + x.pct, 0) / Math.max(1, per.length)) }
}

export function portfolioName(pf: any) { return pf?.name || pf?.id }

/* Suitability rule used everywhere: diversified products may sit up to two risk
   levels above the profile (the asset-mix band controls how much); concentrated
   PMS/AIF need a moderately aggressive profile or higher. */
export function fitsProfile(p: any, profile: string) {
  const cr = RISK_ORDER.indexOf(profile)
  if (cr < 0 || !p) return true
  if (['PMS', 'AIF'].includes(p.category)) return cr >= 3
  return (PRODUCT_RISK[p.risk] ?? 2) <= cr + 2
}
