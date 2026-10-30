import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, CalendarDays, Flag, Gem, Inbox, LayoutGrid, LineChart, Newspaper, Target, Trophy, User, UserRoundSearch, Users, Wallet } from 'lucide-react'
import { ago, date, inr, time, when, daysFrom, label, todayISO } from '../lib/format'
import { assetClassOf, bookHistory, ldStats, SEGMENTS, STAGES } from '../lib/data'
import { Area, AllocBar } from '../charts'
import { ASSET_COLORS, Avatar, Bar, Num, Status } from '../ui'
import { Change, DrillCard } from '../ui/Drill'
import { revenueSoFar } from '../lib/drill'

export type Ctx = {
  clients: any[]; prospects: any[]; products: any[]; portfolios: any[]; meetings: any[]; requests: any[]
  growth: any; ld: any[]; research: any[]
}
export type PickKind = 'client' | 'prospect' | 'product' | 'portfolio' | 'meeting' | 'goal' | 'contest' | 'request'
export type WidgetDef = {
  type: string; name: string; desc: string; icon: any; pick?: PickKind; w: number; h: number; minW?: number; minH?: number
  render: (ctx: Ctx, ref?: string) => ReactNode
  title?: (ctx: Ctx, ref?: string) => string
  href?: (ref?: string) => string
}

const Head = ({ title, href, sub }: { title: string; href?: string; sub?: string }) => (
  <div className="w-head">
    <div className="grow" style={{ minWidth: 0 }}>
      <h3 className="ellipsis">{title}</h3>
      {sub && <div className="tiny muted ellipsis">{sub}</div>}
    </div>
    {href && <Link to={href} className="iconbtn w-open" aria-label={`Open ${title}`}><ArrowUpRight /></Link>}
  </div>
)

/* Book at a glance: the whole book by asset class, opening down to product type, category, product and clients */
const BOOK_LEVELS = ['asset_class', 'product_type', 'subcategory', 'product', 'client'] as const
function BookGlance({ clients, products }: { clients: any[]; products: any[] }) {
  const months: Record<string, number> = {}
  clients.forEach((c) => (c.history || []).forEach((h: any) => (months[h.month] = (months[h.month] || 0) + (h.revenue || 0))))
  const rev = revenueSoFar(Object.keys(months).sort().map((m) => ({ month: m, revenue: months[m] })))
  return (
    <DrillCard compact title="Book at a glance" clients={clients} products={products} levels={[...BOOK_LEVELS]}
      headAside={<Link to="/clients" className="iconbtn w-open" aria-label="Open Clients"><ArrowUpRight /></Link>}
      foot={<div className="small">
        <div className="spread"><span className="muted">Revenue this fiscal year</span><Num v={rev.now} src="Trail and advisory fees, sample data" className="strong" /></div>
        {rev.before > 0 && <div className="row tiny muted" style={{ gap: 6, justifyContent: 'flex-end', marginTop: 2 }}><Change now={rev.now} prev={rev.before} />on the same months last year</div>}
      </div>} />
  )
}

const Missing = ({ what }: { what: string }) => <div className="empty small">This {what} is no longer available. Remove the widget or pick another.</div>

export const WIDGETS: WidgetDef[] = [
  /* ---------------- summaries */
  {
    type: 'book', name: 'Book at a glance', desc: 'Your book by asset class; open any line to go deeper', icon: Wallet, w: 4, h: 7, minW: 3, minH: 5,
    render: ({ clients, products }) => <BookGlance clients={clients} products={products} />,
  },
  {
    type: 'aum_trend', name: 'Assets over 12 months', desc: 'How your book has moved', icon: LineChart, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ clients }) => {
      const aum = clients.reduce((a, c) => a + c.aum, 0)
      const h = bookHistory(aum)
      const ch = ((h.values[11] - h.values[0]) / h.values[0]) * 100
      return (
        <>
          <Head title="Assets over 12 months" sub="Illustrative history on sample data" />
          <div className="row" style={{ alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span className="display" style={{ fontSize: 22, color: 'var(--ink-strong)' }}>{inr(aum)}</span>
            <span className="delta up">▲ {ch.toFixed(1)}% in a year</span>
          </div>
          <div style={{ marginTop: 'auto' }}><Area points={h.values} labels={h.labels} format={(v) => inr(v)} height={88} /></div>
        </>
      )
    },
  },
  {
    type: 'today', name: 'Today', desc: 'Who you’re seeing today and the MoMs still to write', icon: CalendarDays, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ meetings, clients, prospects }) => {
      const t = todayISO()
      const today = meetings.filter((m) => m.start.slice(0, 10) === t && m.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start))
      const moms = meetings.filter((m) => m.status === 'needs_mom').sort((a, b) => b.start.localeCompare(a.start))
      const nm = (m: any) => (m.with.kind === 'client' ? clients : prospects).find((x) => x.id === m.with.id)?.name
      return (
        <>
          <Head title="Today" href="/meetings" sub={[today.length ? `${today.length} meeting${today.length > 1 ? 's' : ''}` : 'No meetings', moms.length ? `${moms.length} MoM${moms.length > 1 ? 's' : ''} to write` : null].filter(Boolean).join(' · ')} />
          <div className="w-split">
          <div className="col" style={{ gap: 0 }}>
            <div className="tiny muted w-sub">Meetings</div>
            {today.length === 0 && <div className="small muted" style={{ padding: '8px 0' }}>No meetings today. A good day to clear MoMs and follow-ups.</div>}
            {today.map((m) => (
              <Link key={m.id} to={`/meetings?m=${m.id}`} className="w-line">
                <span className="num small strong" style={{ width: 62 }}>{time(m.start)}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: 'block' }}>{m.title}</span>
                  <span className="tiny muted ellipsis" style={{ display: 'block' }}>{nm(m)} · {m.location}</span>
                </span>
                {m.status === 'needs_mom' && <Status s="needs_mom" />}
              </Link>
            ))}
          </div>
          {moms.length > 0 && (
            <div className="col" style={{ gap: 0 }}>
              <div className="tiny muted w-sub">MoMs to write</div>
              {moms.slice(0, 3).map((m) => (
                <Link key={m.id} to={`/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}?panel=agent&mom=${m.id}`} className="w-line">
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="ellipsis" style={{ display: 'block' }}>{m.title}</span>
                    <span className="tiny muted ellipsis" style={{ display: 'block' }}>{nm(m)} · {when(m.start)}</span>
                  </span>
                  <span className="linkbtn tiny" style={{ flex: 'none' }}>Write MoM</span>
                </Link>
              ))}
              {moms.length > 3 && <Link to="/meetings" className="linkbtn tiny" style={{ paddingTop: 6 }}>All {moms.length} on Meetings</Link>}
            </div>
          )}
          </div>
        </>
      )
    },
  },
  {
    type: 'pipeline', name: 'Prospect pipeline', desc: 'Prospects by stage and value', icon: UserRoundSearch, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ prospects }) => {
      const open = prospects.filter((p) => p.stage !== 'Closed')
      const total = open.reduce((a, p) => a + p.estimated_investable, 0)
      const weighted = open.reduce((a, p) => a + p.estimated_investable * p.probability / 100, 0)
      const maxStage = Math.max(1, ...STAGES.map((s) => open.filter((p) => p.stage === s).reduce((a, p) => a + p.estimated_investable, 0)))
      return (
        <>
          <Head title="Prospect pipeline" href="/prospects" sub={`${open.length} open · ${inr(total)} potential · ${inr(weighted)} weighted`} />
          <div className="col" style={{ gap: 7 }}>
            {STAGES.map((s) => {
              const ps = open.filter((p) => p.stage === s)
              const v = ps.reduce((a, p) => a + p.estimated_investable, 0)
              return (
                <div key={s} className="row small" style={{ gap: 10 }}>
                  <span style={{ width: 128 }} className="ellipsis muted">{s}</span>
                  <div className="grow"><Bar v={(v / maxStage) * 100} /></div>
                  <span className="num" style={{ width: 70, textAlign: 'right' }}>{ps.length ? inr(v) : '—'}</span>
                </div>
              )
            })}
          </div>
        </>
      )
    },
  },
  {
    type: 'incentive', name: 'Incentive progress', desc: 'Points, slab and projected payout', icon: Trophy, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ growth }) => {
      if (!growth?.points) return null
      const p = growth.points
      const slabs = p.slabs
      const cur = [...slabs].reverse().find((s: any) => p.this_quarter >= s.from)
      const next = slabs.find((s: any) => s.from > p.this_quarter)
      return (
        <>
          <Head title="Incentive progress" href="/growth" sub={growth.period.name} />
          <div className="spread" style={{ alignItems: 'flex-end' }}>
            <div className="stat"><span className="value">{p.this_quarter}<span className="small muted"> pts</span></span><span className="sub">{cur?.name} slab</span></div>
            <div className="stat" style={{ textAlign: 'right' }}><span className="label">Projected payout</span><span className="display strong" style={{ fontSize: 18 }}><Num v={p.projected_payout} src="Projection at current pace" /></span></div>
          </div>
          {next && (
            <div style={{ marginTop: 14 }}>
              <Bar v={(p.this_quarter / next.from) * 100} brass />
              <div className="tiny muted" style={{ marginTop: 6 }}>{next.from - p.this_quarter} points to {next.name}. At your current pace you reach {p.projected_quarter} by quarter end.</div>
            </div>
          )}
        </>
      )
    },
  },
  {
    type: 'ld', name: 'Learning progress', desc: 'Product L&D completed and in progress', icon: BookOpen, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ products, ld }) => {
      const s = ldStats(products, ld)
      const next = s.per.filter((x) => x.pct > 0 && x.pct < 100).slice(0, 3)
      return (
        <>
          <Head title="Learning progress" href="/products?ld=1" sub={`${s.done} done · ${s.started} in progress · ${s.notStarted} not started`} />
          <div className="row" style={{ gap: 16, marginBottom: 12 }}>
            <div className="ld-ring lg" style={{ ['--p' as any]: s.overall, width: 54, height: 54 }} data-label={`${s.overall}%`} />
            <div className="small muted">Across {products.length} products on the shelf.</div>
          </div>
          <div className="col" style={{ gap: 0 }}>
            {next.map((x) => (
              <Link key={x.id} to={`/products/${x.id}?panel=ld`} className="w-line">
                <span className="grow ellipsis small">{x.name}</span>
                <span className="tiny muted num">{x.completed}/{x.total}</span>
              </Link>
            ))}
          </div>
        </>
      )
    },
  },
  {
    type: 'requests_sum', name: 'Requests in flight', desc: 'What you’re waiting on and what waits on you', icon: Inbox, w: 4, h: 3, minW: 3, minH: 3,
    render: ({ requests }) => {
      const me = requests.filter((r) => r.direction === 'waiting_on_me')
      const others = requests.filter((r) => r.direction === 'waiting_on_others')
      return (
        <>
          <Head title="Requests in flight" href="/requests" />
          <div className="g2 grid" style={{ gap: 10 }}>
            <Link to="/requests?tab=me" className="sunk" style={{ padding: 12 }}><div className="display row" style={{ fontSize: 24, color: 'var(--ink-strong)', gap: 8 }}>{me.length}{me.length > 0 && <span className="ring" aria-hidden />}</div><div className="tiny muted">waiting on you</div></Link>
            <Link to="/requests?tab=others" className="sunk" style={{ padding: 12 }}><div className="display" style={{ fontSize: 24, color: 'var(--ink-strong)' }}>{others.length}</div><div className="tiny muted">with other teams</div></Link>
          </div>
          {me.length > 0 && (
            <div className="col" style={{ gap: 0, marginTop: 10 }}>
              <div className="tiny muted w-sub">Waiting on you</div>
              {me.slice(0, 2).map((r) => (
                <Link key={r.id} to={`/requests?tab=me&r=${r.id}`} className="w-line small">
                  <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: 'block' }}>{r.title}</span><span className="tiny muted">{r.team}{r.due ? ` · due ${when(r.due).toLowerCase()}` : ''}</span></span>
                </Link>
              ))}
            </div>
          )}
        </>
      )
    },
  },
  {
    type: 'segments', name: 'Client health', desc: 'Active, engaged, dormant and lost', icon: Users, w: 4, h: 3, minW: 3, minH: 3,
    render: ({ clients }) => (
      <>
        <Head title="Client health" href="/clients" />
        <div className="col" style={{ gap: 8 }}>
          {SEGMENTS.map((s) => {
            const n = clients.filter((c) => c.segment === s.key).length
            return (
              <Link key={s.key} to={`/clients?segment=${s.key}`} className="row small" style={{ gap: 10 }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
                <span className="grow">{s.label}</span>
                <span className="num strong">{n}</span>
              </Link>
            )
          })}
        </div>
      </>
    ),
  },
  {
    type: 'research', name: 'House view and markets', desc: 'CIO notes and market events', icon: Newspaper, w: 4, h: 4, minW: 3, minH: 3,
    render: ({ research }) => (
      <>
        <Head title="House view and markets" href="/products?tab=research" />
        <div className="col" style={{ gap: 0 }}>
          {research.slice(0, 4).map((r) => (
            <div key={r.id} className="w-line" style={{ alignItems: 'flex-start' }}>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="small" style={{ display: 'block' }}>{r.title}</span>
                <span className="tiny muted">{r.kind} · {date(r.date)}</span>
              </span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    type: 'new_products', name: 'New on the shelf', desc: 'Launches and closing soon', icon: Gem, w: 4, h: 3, minW: 3, minH: 3,
    render: ({ products }) => {
      const ps = products.filter((p) => p.is_new || p.close_date).slice(0, 4)
      return (
        <>
          <Head title="New on the shelf" href="/products" />
          {ps.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="w-line">
              <span className="grow ellipsis small">{p.name}</span>
              {p.close_date ? <span className="pill brass">Closes {date(p.close_date)}</span> : <span className="pill forest">New</span>}
            </Link>
          ))}
        </>
      )
    },
  },

  /* ---------------- pick an item (reusable) */
  {
    type: 'client', name: 'Client card', desc: 'Pin any client; place it again for another', icon: User, pick: 'client', w: 4, h: 4, minW: 3, minH: 3,
    href: (id) => `/clients/${id}`,
    render: ({ clients, meetings }, id) => {
      const c = clients.find((x) => x.id === id)
      if (!c) return <Missing what="client" />
      const next = meetings.filter((m) => m.with.id === id && m.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))[0]
      return (
        <>
          <div className="w-head">
            <Avatar name={c.name} photo={c.photo} size={36} />
            <div className="grow" style={{ minWidth: 0 }}><h3 className="ellipsis">{c.name}</h3><div className="tiny muted">{c.risk_profile} · {label(c.segment)}</div></div>
            <Link to={`/clients/${c.id}`} className="iconbtn w-open" aria-label="Open client"><ArrowUpRight /></Link>
          </div>
          <div className="spread"><span className="display strong" style={{ fontSize: 20 }}><Num v={c.aum} /></span><span className="small muted">XIRR {c.xirr}%</span></div>
          <div style={{ margin: '10px 0' }}><AllocBar parts={Object.entries(c.allocation as Record<string, number>).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} /></div>
          <div className="col tiny" style={{ gap: 4, marginTop: 'auto' }}>
            <span className="muted">Last contact {ago(c.last_contact)}</span>
            {next ? <span>Next: {next.title}, {when(next.start)}</span> : <span className="muted">No meeting scheduled</span>}
            {c.red_flags[0] && <span className={`sev ${c.red_flags[0].severity}`}>{c.red_flags[0].text}</span>}
          </div>
        </>
      )
    },
  },
  {
    type: 'prospect', name: 'Prospect card', desc: 'Pin any prospect', icon: UserRoundSearch, pick: 'prospect', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ prospects }, id) => {
      const p = prospects.find((x) => x.id === id)
      if (!p) return <Missing what="prospect" />
      return (
        <>
          <div className="w-head">
            <Avatar name={p.name} size={36} />
            <div className="grow" style={{ minWidth: 0 }}><h3 className="ellipsis">{p.name}</h3><div className="tiny muted">{p.stage} · {p.source}</div></div>
            <Link to={`/prospects/${p.id}`} className="iconbtn w-open" aria-label="Open prospect"><ArrowUpRight /></Link>
          </div>
          <div className="spread"><span className="display strong" style={{ fontSize: 20 }}><Num v={p.estimated_investable} src="RM estimate" /></span><span className="small muted">{p.probability}% likely</span></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>{p.need}</div>
          {p.next_step && <div className="tiny" style={{ marginTop: 'auto' }}>Next: {p.next_step}, {when(p.next_step_date)}</div>}
        </>
      )
    },
  },
  {
    type: 'product', name: 'Product card', desc: 'Pin a product you’re selling or learning', icon: Gem, pick: 'product', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ products, ld }, id) => {
      const p = products.find((x) => x.id === id)
      if (!p) return <Missing what="product" />
      const done = (ld.find((x) => x.product_id === id)?.completed || []).length
      return (
        <>
          <Head title={p.name} href={`/products/${p.id}`} sub={`${p.category} · ${p.sub_category}`} />
          <div className="row" style={{ gap: 8 }}><Status s={p.cio_view.stance}>CIO: {p.cio_view.stance}</Status><span className="pill outline">Risk: {p.risk}</span></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>{p.cio_view.comment.slice(0, 120)}…</div>
          <div className="row tiny" style={{ marginTop: 'auto', gap: 8 }}><Bar v={(done / p.ld.modules.length) * 100} /><span className="num muted">L&amp;D {done}/{p.ld.modules.length}</span></div>
        </>
      )
    },
  },
  {
    type: 'portfolio', name: 'Portfolio', desc: 'Jump straight back into a draft', icon: LayoutGrid, pick: 'portfolio', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ portfolios, clients, prospects, products }, id) => {
      const pf = portfolios.find((x) => x.id === id)
      if (!pf) return <Missing what="portfolio" />
      const who = pf.tag ? [...clients, ...prospects].find((x) => x.id === pf.tag.id)?.name : 'Practice'
      const used = pf.lines.reduce((a: number, l: any) => a + l.amount, 0)
      return (
        <>
          <Head title={pf.name} href={`/studio/${pf.id}`} sub={`${pf.id} · ${who}`} />
          <div className="row" style={{ gap: 8, marginBottom: 10 }}><Status s={pf.status} /><span className="small muted">{pf.lines.length} products</span></div>
          <div className="spread small"><span className="muted">Allocated</span><span className="num strong">{inr(used)} of {inr(pf.amount)}</span></div>
          <div style={{ marginTop: 6 }}><Bar v={(used / Math.max(1, pf.amount)) * 100} /></div>
          {used > 0 && (() => {
            const mix: Record<string, number> = {}
            pf.lines.forEach((l: any) => { const k = assetClassOf(products.find((p: any) => p.id === l.product_id)); mix[k] = (mix[k] || 0) + l.amount })
            return (
              <div style={{ marginTop: 14 }}>
                <div className="tiny muted w-sub" style={{ paddingTop: 0 }}>Asset mix</div>
                <AllocBar parts={Object.entries(mix).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
                <div className="row wrap tiny muted" style={{ gap: 10, marginTop: 6 }}>{Object.entries(mix).map(([k, v]) => <span key={k} className="row" style={{ gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[k] }} />{k} {Math.round((v / used) * 100)}%</span>)}</div>
              </div>
            )
          })()}
          <Link to={`/studio/${pf.id}`} className="linkbtn small" style={{ marginTop: 'auto', paddingTop: 10 }}>Continue in Studio <ArrowUpRight /></Link>
        </>
      )
    },
  },
  {
    type: 'meeting', name: 'Meeting', desc: 'Keep one meeting’s prep in view', icon: CalendarDays, pick: 'meeting', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ meetings }, id) => {
      const m = meetings.find((x) => x.id === id)
      if (!m) return <Missing what="meeting" />
      return (
        <>
          <Head title={m.title} href={`/meetings?m=${m.id}`} sub={`${when(m.start)} · ${m.location}`} />
          <Status s={m.status} />
          <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18 }}>{m.agenda.slice(0, 3).map((a: string) => <li key={a}>{a}</li>)}</ul>
        </>
      )
    },
  },
  {
    type: 'goal', name: 'Goal', desc: 'One of your Five Goals', icon: Target, pick: 'goal', w: 4, h: 2, minW: 3, minH: 2,
    render: ({ growth }, id) => {
      const g = growth?.goals?.find((x: any) => x.id === id)
      if (!g) return <Missing what="goal" />
      return (
        <>
          <Head title="Goal" href="/growth" sub={g.by === 'manager' ? `Set by ${g.set_by}` : 'Yours'} />
          <div className="display" style={{ fontSize: 16, color: 'var(--ink-strong)', lineHeight: 1.3 }}>{g.text}</div>
          {g.progress != null && <div style={{ marginTop: 'auto' }}><Bar v={g.progress * 100} /></div>}
        </>
      )
    },
  },
  {
    type: 'contest', name: 'Contest', desc: 'Follow a contest you’re in', icon: Flag, pick: 'contest', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ growth }, id) => {
      const c = growth?.contests?.find((x: any) => x.id === id)
      if (!c) return <Missing what="contest" />
      return (
        <>
          <Head title={c.name} href="/growth" sub={`Ends ${when(c.ends)} · ${c.rule}`} />
          <div className="display" style={{ fontSize: 22, color: 'var(--ink-strong)' }}>#{c.my_rank}</div>
          <div className="col tiny" style={{ gap: 3, marginTop: 8 }}>
            {c.leaderboard.slice(0, 3).map((r: any, i: number) => <div key={r.name} className="spread"><span className={r.me ? 'strong' : ''}>{i + 1}. {r.name}</span><span className="num">{r.value > 1000 ? inr(r.value) : r.value}</span></div>)}
          </div>
        </>
      )
    },
  },
  {
    type: 'request', name: 'Request tracker', desc: 'Track one request or ticket', icon: Inbox, pick: 'request', w: 4, h: 3, minW: 3, minH: 3,
    render: ({ requests }, id) => {
      const r = requests.find((x) => x.id === id)
      if (!r) return <Missing what="request" />
      const last = r.trail[r.trail.length - 1]
      return (
        <>
          <Head title={r.title} href={`/requests?r=${r.id}`} sub={`${r.id} · ${r.team}`} />
          <Status s={r.status} />
          <div className="tiny muted" style={{ marginTop: 10 }}>{last.by}: {last.text}</div>
          {r.due && <div className="tiny" style={{ marginTop: 'auto' }}>{(daysFrom(r.due) ?? 0) < 0 ? `Overdue · due ${when(r.due).toLowerCase()}` : `Due ${when(r.due).toLowerCase()}`}</div>}
        </>
      )
    },
  },
]
export const WIDGET = Object.fromEntries(WIDGETS.map((w) => [w.type, w]))


export const DEFAULT_LAYOUT = [
  { i: 'w-today', type: 'today', x: 0, y: 0, w: 8, h: 7 },
  { i: 'w-book', type: 'book', x: 8, y: 0, w: 4, h: 7 },
  { i: 'w-pipe', type: 'pipeline', x: 0, y: 7, w: 4, h: 4 },
  { i: 'w-inc', type: 'incentive', x: 4, y: 7, w: 4, h: 4 },
  { i: 'w-req', type: 'requests_sum', x: 8, y: 7, w: 4, h: 4 },
  { i: 'w-cl', type: 'client', ref: 'CL-1001', x: 0, y: 11, w: 4, h: 4 },
  { i: 'w-pf', type: 'portfolio', ref: 'PF-2026-000118', x: 4, y: 11, w: 4, h: 4 },
  { i: 'w-ld', type: 'ld', x: 8, y: 11, w: 4, h: 4 },
]
