import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { assetClassOf, EQUITY_BAND, fitsProfile, RISK_ORDER, useClients, useModels, useProducts, useProspects } from '../lib/data'
import { ago, inr } from '../lib/format'
import { AllocBar } from '../charts'
import { ASSET_COLORS, Bar, DetailSkeleton, Empty, Status, useToast, SearchField } from '../ui'
import { allocOf } from './Studio'

const SHELVES = [
  { key: 'eq', label: 'Equity funds', f: (p: any) => p.category === 'Mutual fund' && assetClassOf(p) === 'Equity' && !p.sub_category.startsWith('Hybrid') },
  { key: 'hy', label: 'Hybrid', f: (p: any) => p.sub_category.startsWith('Hybrid') && p.id !== 'PD-110' },
  { key: 'debt', label: 'Debt funds', f: (p: any) => p.category === 'Mutual fund' && assetClassOf(p) === 'Debt' },
  { key: 'bond', label: 'Bonds', f: (p: any) => p.category === 'Bond' && assetClassOf(p) === 'Debt' },
  { key: 'fd', label: 'Fixed deposits', f: (p: any) => p.category === 'Fixed deposit' },
  { key: 'pms', label: 'PMS', f: (p: any) => p.category === 'PMS' },
  { key: 'aif', label: 'AIF', f: (p: any) => p.category === 'AIF' },
  { key: 'gold', label: 'Gold', f: (p: any) => assetClassOf(p) === 'Gold' },
  { key: 'cash', label: 'Liquidity', f: (p: any) => ['PD-109', 'PD-110'].includes(p.id) },
]
type Flag = { severity: 'high' | 'medium' | 'low'; text: string }

export default function StudioCanvas() {
  const { id = '' } = useParams()
  const { data: saved, error } = useApi<any>(`/c/portfolios/${id}`)
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: prospects = [] } = useProspects()
  const { data: models = [] } = useModels()
  const [pf, setPf] = useState<any>(null)
  const [shelf, setShelf] = useState('eq')
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState<'saved' | 'saving' | 'idle'>('idle')
  const toast = useToast()
  const t = useRef(0)
  useEffect(() => { if (saved && (!pf || pf.id !== saved.id)) setPf(saved) }, [saved])
  const P = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const locked = pf && ['awaiting_approval', 'approved'].includes(pf.status)

  const change = (patch: any) => {
    if (locked) return
    const next = { ...pf, ...patch }
    setPf(next)
    setSaving('saving')
    window.clearTimeout(t.current)
    t.current = window.setTimeout(async () => {
      await api(`/portfolios/${pf.id}`, { method: 'PUT', body: { name: next.name, amount: next.amount, tag: next.tag, lines: next.lines } })
      invalidate('/c/portfolios')
      setSaving('saved')
    }, 600)
  }

  const who = pf?.tag ? (pf.tag.kind === 'client' ? clients : prospects).find((x) => x.id === pf.tag.id) : null
  const profile = who ? (who.risk_profile || (RISK_ORDER.includes(who.risk_indication) ? who.risk_indication : null)) : null
  const calc = useMemo(() => {
    if (!pf || !products.length) return null
    const used = pf.lines.reduce((a: number, l: any) => a + (l.amount || 0), 0)
    const alloc = allocOf(pf.lines, P)
    const pct = (k: string) => (used ? ((alloc[k] || 0) / used) * 100 : 0)
    const flags: Flag[] = []
    if (used > pf.amount) flags.push({ severity: 'high', text: `Allocated ${inr(used - pf.amount)} more than the portfolio amount.` })
    if (profile) {
      const [lo, hi] = EQUITY_BAND[profile]
      const eq = pct('Equity')
      if (used && eq > hi) flags.push({ severity: 'high', text: `Equity ${eq.toFixed(0)}% is above the ${hi}% ceiling for a ${profile.toLowerCase()} profile.` })
      if (used && eq < lo) flags.push({ severity: 'medium', text: `Equity ${eq.toFixed(0)}% is below the ${lo}% floor for this profile.` })
      pf.lines.forEach((l: any) => { const p = P[l.product_id]; if (p && !fitsProfile(p, profile)) flags.push({ severity: 'high', text: `${p.name} (${p.category === 'PMS' || p.category === 'AIF' ? p.category : p.risk.toLowerCase() + ' risk'}) doesn’t suit a ${profile.toLowerCase()} profile.` }) })
    } else if (pf.tag) flags.push({ severity: 'medium', text: 'No risk profile on record for this person; suitability can’t be checked.' })
    pf.lines.forEach((l: any) => {
      const p = P[l.product_id]
      if (!p) return
      if (l.amount > 0 && l.amount < p.min_investment) flags.push({ severity: 'high', text: `${p.name} needs at least ${inr(p.min_investment)}.` })
      const base = Math.max(used, pf.amount)
      if (base && l.amount / base > 0.3) flags.push({ severity: 'medium', text: `${p.name} is ${Math.round((l.amount / base) * 100)}% of the portfolio. Keep single products under 30%.` })
      if (p.cio_view.stance === 'Under review') flags.push({ severity: 'medium', text: `${p.name} is under CIO review.` })
      if (['PMS', 'AIF'].includes(p.category) && l.amount / Math.max(used, pf.amount, 1) > 0.15 && profile && RISK_ORDER.indexOf(profile) <= 2) flags.push({ severity: 'high', text: `${p.name} above 15% for a ${profile.toLowerCase()} profile.` })
    })
    const w = (fn: (p: any) => number | null) => { let s = 0, n = 0; pf.lines.forEach((l: any) => { const v = fn(P[l.product_id]); if (v != null) { s += v * l.amount; n += l.amount } }); return n ? s / n : null }
    const ret = w((p) => p?.returns?.['3y'] ?? p?.ytm ?? p?.rate ?? p?.coupon ?? (p?.target_irr ? parseFloat(p.target_irr) : null))
    const cost = w((p) => p?.expense_ratio ?? (p?.category === 'PMS' ? 1.9 : p?.category === 'AIF' ? 2.2 : 0))
    const illiquid = pf.lines.filter((l: any) => ['AIF'].includes(P[l.product_id]?.category) || P[l.product_id]?.sub_category === 'Equity: ELSS').reduce((a: number, l: any) => a + l.amount, 0)
    const model = models.find((m) => m.id === pf.model_id)
    let deviation: number | null = null
    if (model && used) {
      const target: Record<string, number> = {}
      model.allocations.forEach((a: any) => (target[a.product_id] = a.weight))
      const ids = new Set([...Object.keys(target), ...pf.lines.map((l: any) => l.product_id)])
      deviation = [...ids].reduce((a, k) => a + Math.abs((target[k] || 0) - ((pf.lines.find((l: any) => l.product_id === k)?.amount || 0) / used) * 100), 0) / 2
    }
    const overlap = who?.holdings ? pf.lines.filter((l: any) => who.holdings.some((h: any) => h.product_id === l.product_id)).length : 0
    return { used, alloc, pct, flags, ret, cost, illiquid, model, deviation, overlap }
  }, [pf, products, profile, models, who])

  if (error) return <main className="page"><Empty title="Portfolio not found" action={<Link className="btn btn-quiet" to="/studio">Back to Studio</Link>} /></main>
  if (!pf || !calc) return <DetailSkeleton />

  const setLine = (pid: string, amount: number) => change({ lines: pf.lines.map((l: any) => (l.product_id === pid ? { ...l, amount: Math.max(0, Math.round(amount)) } : l)) })
  const add = (pid: string) => {
    if (pf.lines.some((l: any) => l.product_id === pid)) return toast('Already in the portfolio')
    const rest = Math.max(0, pf.amount - calc.used)
    change({ lines: [...pf.lines, { product_id: pid, amount: Math.max(P[pid].min_investment, Math.min(rest, pf.amount * 0.1)) }] })
  }
  const remove = (pid: string) => change({ lines: pf.lines.filter((l: any) => l.product_id !== pid) })
  const exportJson = () => {
    const doc = { schema: 'kova.portfolio.v1', id: pf.id, name: pf.name, amount: pf.amount, tag: pf.tag, status: pf.status, model_id: pf.model_id || null,
      lines: pf.lines.map((l: any) => ({ product_id: l.product_id, product: P[l.product_id]?.name, amount: l.amount, weight: calc.used ? +((l.amount / calc.used) * 100).toFixed(2) : 0 })),
      exported_at: new Date().toISOString() }
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${pf.id}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const submit = async () => {
    try {
      const r = await api(`/portfolios/${pf.id}/submit`, { body: { flags: calc.flags } })
      setPf(r.portfolio); invalidate('/c/')
      toast(<>Sent to the CIO Office. <Link to={`/requests?r=${r.request.id}`}>Track {r.request.id}</Link></>)
    } catch (e: any) { toast(e.message) }
  }
  const comingSoon = () => toast('The field-level agent is coming soon.')
  const groups: Record<string, any[]> = {}
  pf.lines.forEach((l: any) => (groups[assetClassOf(P[l.product_id])] ||= []).push(l))
  const shelfList = products.filter((p) => SHELVES.find((s) => s.key === shelf)!.f(p) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
  const remaining = pf.amount - calc.used

  return (
    <main className="page studio">
      <Link to="/studio" className="crumb"><ArrowLeft size={14} />Portfolio Studio</Link>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div className="grow">
          <input className="title-input" value={pf.name} disabled={locked} onChange={(e) => change({ name: e.target.value })} aria-label="Portfolio name" />
          <p className="small muted" style={{ marginTop: 4 }}><span className="num">{pf.id}</span> · {pf.source === 'recommended' && calc.model ? `from ${calc.model.name}` : pf.source} · <Status s={pf.status} /> · {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : `Updated ${ago(pf.updated)}`}</p>
        </div>
        <button className="btn btn-quiet" onClick={exportJson}><Download />Export JSON</button>
      </div>
      {pf.status === 'changes_requested' && <div className="note-card attention small" style={{ marginBottom: 16 }}><span className="strong">The CIO Office asked for changes.</span> {pf.note || pf.history?.slice(-1)[0]?.event} Edit the portfolio below and send it again.</div>}
      {locked && <div className="note-card small" style={{ marginBottom: 16 }}>{pf.status === 'approved' ? 'Approved by the CIO Office. Create a copy to make changes.' : 'With the CIO Office for approval. Editing is locked until they respond.'}</div>}

      <div className="studio-grid">
        <div className="col" style={{ gap: 16, minWidth: 0 }}>
          {!locked && (
            <section className="panel">
              <div className="list-toolbar" style={{ gap: 8 }}>
                <div className="row wrap" style={{ gap: 6 }}>{SHELVES.map((s) => <button key={s.key} className={`chip ${shelf === s.key ? 'on' : ''}`} onClick={() => setShelf(s.key)}>{s.label}</button>)}</div>
                <SearchField value={q} onChange={setQ} placeholder="Find a product…" label="Find a product on the shelf" height={32} width={200} style={{ marginLeft: 'auto' }} />
              </div>
              <div className="shelf">
                {shelfList.map((p) => {
                  const inPf = pf.lines.some((l: any) => l.product_id === p.id)
                  return (
                    <div key={p.id} className={`shelf-item ${inPf ? 'in' : ''}`}>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small strong ellipsis">{p.name}</div>
                        <div className="tiny muted ellipsis">{p.risk} · min {inr(p.min_investment)} · {p.returns?.['3y'] ? `${p.returns['3y']}% 3y` : p.ytm ? `${p.ytm}% YTM` : p.rate ? `${p.rate}%` : p.target_irr || ''}</div>
                      </div>
                      <Status s={p.cio_view.stance} />
                      {inPf ? <span className="shelf-added"><Check size={13} aria-hidden />Added</span> : <button className="iconbtn" onClick={() => add(p.id)} aria-label={`Add ${p.name}`}><Plus aria-hidden /></button>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head"><h2>Portfolio</h2><span className="aside">{pf.lines.length} products</span></div>
            {pf.lines.length === 0 && <Empty title="Nothing added yet">Pick products from the shelf above. The panel on the right keeps count as you go.</Empty>}
            {Object.entries(groups).map(([cls, ls]) => (
              <div key={cls} className="line-group">
                <div className="spread" style={{ padding: '10px 20px 6px' }}><span className="row small strong" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: ASSET_COLORS[cls] }} />{cls}</span><span className="small num muted">{inr(ls.reduce((a, l) => a + l.amount, 0))} · {calc.pct(cls).toFixed(0)}%</span></div>
                {ls.map((l) => {
                  const p = P[l.product_id]
                  const share = pf.amount ? (l.amount / pf.amount) * 100 : 0
                  const under = l.amount > 0 && l.amount < p.min_investment
                  return (
                    <div key={l.product_id} className="line">
                      <div className="grow" style={{ minWidth: 0 }}>
                        <Link to={`/products/${p.id}`} className="small strong">{p.name}</Link>
                        <div className="tiny muted">{p.sub_category} · {p.liquidity}</div>
                        {under && <div className="tiny" style={{ color: 'var(--loss-ink)' }}>Minimum is {inr(p.min_investment)}</div>}
                      </div>
                      <label className="amt"><span className="tiny muted">₹</span><input className="input sm num" type="number" step={10000} value={l.amount} disabled={locked} onChange={(e) => setLine(l.product_id, +e.target.value)} /></label>
                      <label className="amt pct"><input className="input sm num" type="number" step={0.5} value={+share.toFixed(1)} disabled={locked} onChange={(e) => setLine(l.product_id, (pf.amount * +e.target.value) / 100)} /><span className="tiny muted">%</span></label>
                      <button className="iconbtn field-agent" title="Ask the agent about this line (coming soon)" aria-label={`Ask the agent about ${p.name} (coming soon)`} onClick={comingSoon}><Sparkles aria-hidden /></button>
                      {!locked && <button className="iconbtn" aria-label={`Remove ${p.name}`} onClick={() => remove(l.product_id)}><Trash2 /></button>}
                    </div>
                  )
                })}
              </div>
            ))}
          </section>
        </div>

        <aside className="master panel">
          <div className="master-sec">
            <div className="spread"><h3>Master data</h3><button className="iconbtn field-agent" title="Ask the agent to critique (coming soon)" aria-label="Ask the agent to critique the portfolio (coming soon)" onClick={comingSoon}><Sparkles aria-hidden /></button></div>
            <label className="field" style={{ marginTop: 10 }}><span>For</span>
              <select className="select sm" disabled={locked} value={pf.tag ? `${pf.tag.kind}:${pf.tag.id}` : ''} onChange={(e) => change({ tag: e.target.value ? { kind: e.target.value.split(':')[0], id: e.target.value.split(':')[1] } : null })}>
                <option value="">No one (practice)</option>
                <optgroup label="Clients">{clients.filter((c) => c.segment !== 'lost').map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}</optgroup>
                <optgroup label="Prospects">{prospects.filter((p) => p.stage !== 'Closed').map((p) => <option key={p.id} value={`prospect:${p.id}`}>{p.name}</option>)}</optgroup>
              </select>
            </label>
            {who && <div className="tiny muted" style={{ marginTop: 6 }}>Risk profile: {profile || 'not assessed'} · {who.aum !== undefined ? `${inr(who.aum)} with Kova` : `${inr(who.estimated_investable)} estimated`}</div>}
            <label className="field" style={{ marginTop: 10 }}><span>Portfolio amount</span><input className="input sm num" type="number" step={100000} disabled={locked} value={pf.amount} onChange={(e) => change({ amount: +e.target.value })} /></label>
          </div>
          <div className="master-sec">
            <div className="spread small"><span>Allocated</span><span className="num strong">{inr(calc.used)} of {inr(pf.amount)}</span></div>
            <div style={{ margin: '6px 0' }}><Bar v={(calc.used / Math.max(1, pf.amount)) * 100} brass={calc.used > pf.amount} /></div>
            <div className={`small ${remaining < 0 ? 'u-overdue-l' : 'muted'}`}>{remaining >= 0 ? `${inr(remaining)} left to place` : `${inr(-remaining)} over`}</div>
          </div>
          <div className="master-sec">
            <h3 style={{ marginBottom: 8 }}>Asset mix</h3>
            <AllocBar parts={Object.entries(calc.alloc).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
            <div className="col small" style={{ gap: 4, marginTop: 8 }}>
              {['Equity', 'Debt', 'Gold', 'Cash'].map((k) => <div key={k} className="spread"><span className="row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[k] }} />{k}</span><span className="num">{calc.pct(k).toFixed(0)}%{k === 'Equity' && profile ? <span className="tiny muted"> · band {EQUITY_BAND[profile][0]}–{EQUITY_BAND[profile][1]}%</span> : null}</span></div>)}
            </div>
          </div>
          <div className="master-sec">
            <h3 style={{ marginBottom: 8 }}>Numbers</h3>
            <dl className="kv small" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Illustrative return</dt><dd className="num">{calc.ret ? `${calc.ret.toFixed(1)}% a year` : '—'}</dd>
              <dt>Weighted cost</dt><dd className="num">{calc.cost != null ? `${calc.cost.toFixed(2)}% a year` : '—'}</dd>
              <dt>Locked in or illiquid</dt><dd className="num">{calc.used ? `${Math.round((calc.illiquid / calc.used) * 100)}%` : '—'}</dd>
              {calc.model && <><dt>Away from {calc.model.name}</dt><dd className="num">{calc.deviation != null ? `${calc.deviation.toFixed(0)}%` : '—'}</dd></>}
              {who?.holdings && <><dt>Already held</dt><dd className="num">{calc.overlap} of {pf.lines.length}</dd></>}
            </dl>
            <p className="tiny faint" style={{ marginTop: 6 }}>Return is a weighted average of past returns and yields. It is not a promise.</p>
          </div>
          <div className="master-sec">
            <h3 style={{ marginBottom: 8 }}>Suitability</h3>
            {calc.flags.length === 0 ? <p className="small" style={{ color: 'var(--gain-ink)' }}>No issues found{profile ? ` for a ${profile.toLowerCase()} profile` : ''}.</p>
              : <div className="col" style={{ gap: 6 }}>{calc.flags.map((f, i) => <div key={i} className={`sev ${f.severity} small`}>{f.text}</div>)}</div>}
          </div>
          <div className="master-sec" style={{ borderBottom: 0 }}>
            {pf.status === 'approved' ? <p className="small" style={{ color: 'var(--gain-ink)' }}>Approved by the CIO Office.</p>
              : pf.status === 'awaiting_approval' ? <p className="small muted">Waiting on the CIO Office. <Link to="/requests?tab=approvals" className="linkbtn">Track it</Link></p>
              : <>
                  <button className="btn btn-primary" style={{ width: '100%' }} disabled={!pf.tag || !pf.lines.length} onClick={submit}><Send />Send for approval</button>
                  <p className="tiny muted" style={{ marginTop: 6 }}>{!pf.tag ? 'Tag a client or prospect first. Practice portfolios stay private.' : `Goes to the CIO Office${calc.flags.some((f) => f.severity === 'high') ? '. High flags will likely come back with changes.' : '.'}`}</p>
                </>}
          </div>
        </aside>
      </div>
    </main>
  )
}
