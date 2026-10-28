import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { fitsProfile, ldStats, useClients, useLd, useProducts, useResearch } from '../lib/data'
import { date, inr } from '../lib/format'
import { Donut, HBars, Legend } from '../charts'
import { LoadError, Num, Panel, SkeletonRows, Stat, Status, SearchField } from '../ui'

const CAT_COLORS: Record<string, string> = { 'Mutual fund': '#1D3A2E', PMS: '#5F7D6E', AIF: '#B0A98E', Bond: '#C9A961', 'Fixed deposit': '#A9B8A9', Credit: '#77736A' }

export function suitsCount(p: any, clients: any[]) {
  return clients.filter((c) => c.segment !== 'lost' && !c.holdings.some((h: any) => h.product_id === p.id) && fitsProfile(p, c.risk_profile) && p.min_investment <= c.aum * 0.25)
}

export default function Products() {
  const { data: products = [], loading, error, reload } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: ld = [] } = useLd()
  const { data: research = [] } = useResearch()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'shelf'
  const [cat, setCat] = useState('')
  const [ldf, setLdf] = useState(params.get('ld') === '1' ? 'progress' : '')
  const [q, setQ] = useState('')
  const s = ldStats(products, ld)
  const ldOf = Object.fromEntries(s.per.map((x) => [x.id, x]))

  const held = useMemo(() => {
    const m: Record<string, { value: number; n: number }> = {}
    clients.forEach((c) => c.holdings.forEach((h: any) => { m[h.product_id] ||= { value: 0, n: 0 }; m[h.product_id].value += h.value; m[h.product_id].n++ }))
    return m
  }, [clients])
  const byCat: Record<string, number> = {}
  products.forEach((p) => (byCat[p.category] = (byCat[p.category] || 0) + (held[p.id]?.value || 0)))
  const total = Object.values(byCat).reduce((a, b) => a + b, 0)
  const top = [...products].sort((a, b) => (held[b.id]?.value || 0) - (held[a.id]?.value || 0)).slice(0, 6)
  const cats = [...new Set(products.map((p) => p.category))]
  const list = products.filter((p) => (!cat || p.category === cat) && (!q || (p.name + p.sub_category + p.manufacturer).toLowerCase().includes(q.toLowerCase()))
    && (!ldf || (ldf === 'done' ? ldOf[p.id]?.pct === 100 : ldf === 'progress' ? ldOf[p.id]?.pct > 0 && ldOf[p.id]?.pct < 100 : ldOf[p.id]?.pct === 0)))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="lede">{products.length} products on the Kova shelf. Your clients hold {inr(total)} across {Object.keys(held).length} of them.</p>
        </div>
        <div className="seg">
          <button className={tab === 'shelf' ? 'on' : ''} aria-pressed={tab === 'shelf'} onClick={() => setParams({})}>Shelf</button>
          <button className={tab === 'research' ? 'on' : ''} aria-pressed={tab === 'research'} onClick={() => setParams({ tab: 'research' })}>House view &amp; research</button>
        </div>
      </div>

      {tab === 'research' ? (
        <div className="grid g-main">
          <Panel title="House view and market notes" aside="From the CIO office and research desk">
            <div className="col" style={{ gap: 0 }}>
              {research.map((r) => (
                <article key={r.id} className="w-line" style={{ alignItems: 'flex-start', padding: '14px 0' }}>
                  <span className="pill outline" style={{ minWidth: 96, justifyContent: 'center' }}>{r.kind}</span>
                  <div className="grow"><h3>{r.title}</h3><p className="small muted" style={{ marginTop: 4 }}>{r.body}</p><div className="tiny faint" style={{ marginTop: 6 }}>{r.author} · {date(r.date)}</div></div>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Coming in the full release"><p className="small muted">Daily notes, event alerts that list your exposed clients with a draft message, and the CIO’s talking points per product.</p></Panel>
        </div>
      ) : (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="statline">
              <Stat label="Held by your clients" value={<Num v={total} />} sub={`in ${Object.keys(held).length} products`} />
              <Stat label="CIO preferred" value={products.filter((p) => p.cio_view.stance === 'Preferred').length} sub={`${products.filter((p) => p.cio_view.stance === 'Under review').length} under review`} />
              <Stat label="Learning completed" value={`${s.done} of ${products.length}`} sub={`${s.started} in progress · ${s.overall}% overall`} />
              <Stat label="New or closing soon" value={products.filter((p) => p.is_new || p.close_date).length} sub="See the list below" />
            </div>
          </section>
          <div className="grid g3" style={{ marginBottom: 16 }}>
            <Panel title="Your book by product type">
              <div className="row" style={{ gap: 18 }}>
                <Donut size={130} data={Object.entries(byCat).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: v, color: CAT_COLORS[k], note: inr(v) }))} center={<div className="tiny muted">by value</div>} />
                <div className="grow"><Legend data={Object.entries(byCat).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: v, color: CAT_COLORS[k] }))} format={(v) => `${Math.round((v / total) * 100)}%`} /></div>
              </div>
            </Panel>
            <Panel title="Most held">
              <HBars data={top.map((p) => ({ label: <Link to={`/products/${p.id}`}>{p.name}</Link>, value: held[p.id]?.value || 0, sub: `${held[p.id]?.n || 0} clients` }))} format={(v) => inr(v)} />
            </Panel>
            <Panel title="Fits your clients" aside="Suitable, not yet held">
              <div className="col" style={{ gap: 0 }}>
                {products.filter((p) => p.cio_view.stance === 'Preferred').map((p) => ({ p, n: suitsCount(p, clients).length })).sort((a, b) => b.n - a.n).slice(0, 5).map(({ p, n }) => (
                  <Link key={p.id} to={`/products/${p.id}?panel=agent&ask=clients`} className="w-line small"><span className="grow ellipsis">{p.name}</span><span className="pill forest">{n} clients</span></Link>
                ))}
              </div>
            </Panel>
          </div>

          <section className="panel">
            <div className="list-toolbar">
              <SearchField value={q} onChange={setQ} placeholder="Name or manufacturer…" label="Search products" width={240} />
              <div className="row wrap" style={{ gap: 6 }}>
                <button className={`chip ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => setCat('')}>All</button>
                {cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
              </div>
              <select className="select sm" style={{ width: 190, marginLeft: 'auto' }} value={ldf} onChange={(e) => setLdf(e.target.value)} aria-label="Learning status">
                <option value="">Any learning status</option><option value="none">Not started</option><option value="progress">In progress</option><option value="done">Completed</option>
              </select>
            </div>
            {error && !products.length ? <LoadError what="products" onRetry={reload} /> : loading && !products.length ? <SkeletonRows rows={8} height={56} /> : <table className="table products-table">
              <thead><tr><th>Product</th><th>Risk</th><th>CIO view</th><th className="r">Returns / yield</th><th className="r">Your clients</th><th>Learning</th><th /></tr></thead>
              <tbody>
                {list.map((p) => {
                  const l = ldOf[p.id]
                  const ret = p.returns?.['3y'] ? `${p.returns['3y']}% 3y` : p.ytm ? `${p.ytm}% YTM` : p.rate ? `${p.rate}% rate` : p.target_irr ? `${p.target_irr} IRR` : '—'
                  return (
                    <tr key={p.id}>
                      <td><Link to={`/products/${p.id}`} className="strong">{p.name}</Link> {p.is_new && <span className="pill forest" style={{ marginLeft: 4 }}>New</span>}{p.close_date && <span className="pill brass" style={{ marginLeft: 4 }}>Closes {date(p.close_date)}</span>}<div className="tiny muted">{p.category} · {p.sub_category} · {p.manufacturer}</div></td>
                      <td className="small">{p.risk}</td>
                      <td><Status s={p.cio_view.stance} /></td>
                      <td className="r num small">{ret}</td>
                      <td className="r small">{held[p.id] ? <><Num v={held[p.id].value} /><div className="tiny muted">{held[p.id].n} clients</div></> : <span className="faint">—</span>}</td>
                      <td>
                        <Link to={`/products/${p.id}?panel=ld`} className={`ld-btn ${l.pct === 100 ? 'done' : l.pct > 0 ? 'progress' : ''}`}>
                          {l.pct === 100 ? <><Check size={13} aria-hidden />Completed</> : l.pct > 0 ? <><span className="ld-mini" aria-hidden><i style={{ width: `${l.pct}%` }} /></span>Continue, {l.completed} of {l.total}</> : <>Start learning</>}
                        </Link>
                      </td>
                      <td><Link to={`/products/${p.id}`} className="iconbtn" aria-label={`Open ${p.name}`}><ChevronRight aria-hidden /></Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>}
          </section>
        </>
      )}
    </main>
  )
}
