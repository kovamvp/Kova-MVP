import { X } from 'lucide-react'
import { SERVICE_CATEGORIES, useProducts } from '../lib/data'

/* What a meeting is for: products to discuss, the portfolio intent and service items.
   Internal only: the invite never includes it. Same lists as backend/meetings.py. */
export const INTENTS = ['Review', 'Rebalance', 'New portfolio', 'Maturity reinvestment']
export type Plan = { products: string[]; portfolio: string | null; service: string[]; notes: string }
export const EMPTY_PLAN: Plan = { products: [], portfolio: null, service: [], notes: '' }

export function PlanFields({ v, onChange, suggest = [] }: { v: Plan; onChange: (p: Plan) => void; suggest?: string[] }) {
  const { data: products = [] } = useProducts()
  const P = Object.fromEntries(products.map((p) => [p.id, p]))
  const pickable = products.filter((p) => p.asset_class && !v.products.includes(p.id))
  const ordered = [...pickable.filter((p) => suggest.includes(p.id)), ...pickable.filter((p) => !suggest.includes(p.id))]
  return (
    <fieldset className="plan-fields">
      <legend>Plan <span className="tiny muted">(only you and your teams see this; it isn’t in the invite)</span></legend>
      <label className="field"><span>Products to discuss</span>
        <select className="select" value="" onChange={(e) => e.target.value && onChange({ ...v, products: [...v.products, e.target.value] })}>
          <option value="">Add a product…</option>
          {suggest.length > 0 && <optgroup label="They hold or asked about">{ordered.filter((p) => suggest.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
          <optgroup label="Kova shelf">{ordered.filter((p) => !suggest.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
        </select>
      </label>
      {v.products.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {v.products.map((id) => <span key={id} className="pill outline plan-chip">{P[id]?.name || id}<button type="button" className="chip-x" aria-label={`Remove ${P[id]?.name || id}`} onClick={() => onChange({ ...v, products: v.products.filter((x) => x !== id) })}><X size={11} /></button></span>)}
        </div>
      )}
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field"><span>Portfolio</span>
          <select className="select" value={v.portfolio || ''} onChange={(e) => onChange({ ...v, portfolio: e.target.value || null })}>
            <option value="">Not on the agenda</option>{INTENTS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </label>
        <label className="field"><span>Service items</span>
          <select className="select" value="" onChange={(e) => e.target.value && onChange({ ...v, service: [...v.service, e.target.value] })}>
            <option value="">Add a service item…</option>{SERVICE_CATEGORIES.filter((s) => !v.service.includes(s)).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {v.service.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {v.service.map((s) => <span key={s} className="pill outline plan-chip">{s}<button type="button" className="chip-x" aria-label={`Remove ${s}`} onClick={() => onChange({ ...v, service: v.service.filter((x) => x !== s) })}><X size={11} /></button></span>)}
        </div>
      )}
      <label className="field"><span>Note to self</span><input className="input" value={v.notes} placeholder="Bring the PMS fee comparison" onChange={(e) => onChange({ ...v, notes: e.target.value })} /></label>
    </fieldset>
  )
}

/* Compact view of a plan, for lists and the prep pack */
export function PlanChips({ plan, P, max = 4 }: { plan?: Plan | null; P: Record<string, any>; max?: number }) {
  if (!plan) return null
  const items = [
    ...(plan.portfolio ? [{ k: 'pf', t: plan.portfolio, cls: 'forest' }] : []),
    ...plan.products.map((id) => ({ k: id, t: P[id]?.name || id, cls: 'outline' })),
    ...plan.service.map((s) => ({ k: s, t: s, cls: 'outline svc' })),
  ]
  if (!items.length) return null
  return (
    <span className="plan-chips">
      {items.slice(0, max).map((x) => <span key={x.k} className={`pill ${x.cls}`}>{x.t}</span>)}
      {items.length > max && <span className="tiny muted">+{items.length - max}</span>}
    </span>
  )
}
