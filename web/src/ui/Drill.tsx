import { ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { drill, Level, LEVEL_NAME, Period, PERIODS, pointLabel, Step } from '../lib/drill'
import { inr } from '../lib/format'
import { ASSET_COLORS, Num } from './index'

/* One analysis card for the whole app: a breakdown you can open one level at a time
   (asset class → product type → category → product → the clients who hold it),
   with each line compared to an earlier point. The period choice is remembered per viewer. */

const PERIOD_KEY = 'kova.period'
const readPeriod = (): Period => {
  try { const v = localStorage.getItem(PERIOD_KEY); return v === 'month' || v === 'quarter' || v === 'fy' ? v : 'fy' } catch { return 'fy' }
}

export function Change({ now, prev }: { now: number; prev?: number }) {
  if (prev === undefined) return null
  if (!prev && now) return <span className="drill-new">New</span>
  if (prev && !now) return <span className="drill-new">Exited</span>
  if (!prev) return null
  const pct = ((now - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return <span className="delta muted">no change</span>
  const up = pct >= 0
  return <span className={`delta ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>
}

export function DrillCard({ title, clients, products, levels, rootLabel = 'Book', foot, compact, headAside, src = 'Sum of client holdings' }: {
  title: ReactNode; clients: any[]; products: any[]; levels: Level[]; rootLabel?: string; foot?: ReactNode; compact?: boolean
  headAside?: ReactNode; src?: string
}) {
  const [path, setPath] = useState<Step[]>([])
  const [period, setPeriodState] = useState<Period>(readPeriod)
  const setPeriod = (p: Period) => { setPeriodState(p); try { localStorage.setItem(PERIOD_KEY, p) } catch { /* private window */ } }
  const d = useMemo(() => drill(clients, products, path, levels, period), [clients, products, path, levels, period])
  const up = (n: number) => setPath(path.slice(0, n))
  const colorOf = (key: string) => (d.level === 'asset_class' ? ASSET_COLORS[key] : undefined)
  const max = Math.max(1, ...d.rows.map((r) => r.value))
  const where = path.length ? path[path.length - 1].label : rootLabel

  return (
    <div className={`drill ${compact ? 'compact' : ''}`}>
      <div className="drill-head">
        <div className="grow" style={{ minWidth: 0 }}>{typeof title === 'string' ? <h3 className="ellipsis">{title}</h3> : title}</div>
        {headAside}
      </div>
      <div className="drill-sub">
          <nav className="drill-crumbs tiny" aria-label="Where you are in the breakdown">
            {path.length > 0 && <button className="iconbtn sm" aria-label="Up one level" onClick={() => up(path.length - 1)}><ArrowLeft size={14} /></button>}
            <button className={`linkbtn ${path.length ? '' : 'here'}`} onClick={() => up(0)} aria-current={path.length ? undefined : 'location'}>{rootLabel}</button>
            {path.map((s, i) => (
              <span key={i} className="row" style={{ gap: 4 }}>
                <ChevronRight size={12} aria-hidden className="muted" />
                <button className={`linkbtn ${i === path.length - 1 ? 'here' : ''}`} aria-current={i === path.length - 1 ? 'location' : undefined} onClick={() => up(i + 1)}>{s.label}</button>
              </span>
            ))}
          </nav>
        <div className="seg sm" role="group" aria-label="Compare with">
          {PERIODS.map((p) => <button key={p.key} className={period === p.key ? 'on' : ''} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} title={`Change over ${p.long}`}>{p.label}</button>)}
        </div>
      </div>

      <div className="drill-total">
        <span className="display strong drill-big"><Num v={d.total} src={src} /></span>
        <Change now={d.total} prev={d.prevTotal} />
        <span className="tiny muted" title={d.at ? `${inr(d.prevTotal)} then` : undefined}>{d.at ? (compact ? pointLabel(d.at, period) : `${pointLabel(d.at, period)}, when it was ${inr(d.prevTotal)}`) : 'No earlier figure to compare with'}</span>
      </div>

      <div className="drill-rows" role="list" aria-label={`${where} by ${LEVEL_NAME[d.level]}`}>
        {d.rows.map((r) => {
          const body = compact ? (
            <span className="drill-line">
              {colorOf(r.key) && <i className="drill-dot" style={{ background: colorOf(r.key) }} aria-hidden />}
              <span className="grow ellipsis drill-label">{r.label}</span>
              <span className="num strong drill-val" title={`${Math.round(r.share * 100)}% of ${where}`}>{inr(r.value)}</span>
              <span className="drill-chg tiny"><Change now={r.value} prev={r.prev} /></span>
            </span>
          ) : (
            <>
              <span className="drill-line">
                {colorOf(r.key) && <i className="drill-dot" style={{ background: colorOf(r.key) }} aria-hidden />}
                <span className="grow ellipsis drill-label">{r.label}</span>
                <span className="num strong">{inr(r.value)}</span>
              </span>
              <span className="drill-line tiny">
                <span className="drill-bar" aria-hidden><i style={{ width: `${(r.value / max) * 100}%`, background: colorOf(r.key) }} /></span>
                <span className="muted num">{Math.round(r.share * 100)}%</span>
                {r.level !== 'client' && <span className="muted">{r.clients} {r.clients === 1 ? 'client' : 'clients'}</span>}
                <Change now={r.value} prev={r.prev} />
              </span>
            </>
          )
          if (r.level === 'client') {
            return <div key={r.key} role="listitem" className="drill-row-wrap"><Link to={`/clients/${r.key}`} className="drill-row" aria-label={`Open ${r.label}`}>{body}<ArrowUpRight size={15} className="drill-go" aria-hidden /></Link></div>
          }
          return (
            <div key={r.key} role="listitem" className="drill-row-wrap">
              <button className="drill-row" disabled={!r.next || !r.value} onClick={() => setPath([...path, { level: r.level, key: r.key, label: r.label }])}
                aria-label={`${r.label}: open by ${r.next ? LEVEL_NAME[r.next] : ''}`}>
                {body}
                {r.next && r.value > 0 && <ChevronRight size={16} className="drill-go" aria-hidden />}
              </button>
              {r.level === 'product' && !compact && <Link to={`/products/${r.key}`} className="drill-open tiny" aria-label={`Open the ${r.label} page`}>Product page</Link>}
            </div>
          )
        })}
        {d.rows.length === 0 && <div className="empty small">Nothing held here.</div>}
      </div>
      {foot && <div className="drill-foot">{foot}</div>}
    </div>
  )
}
