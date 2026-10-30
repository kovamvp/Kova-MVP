import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Check, ChevronRight, LayoutGrid, ListChecks, MessageSquareText, Phone, Receipt, Send, ShieldCheck, X } from 'lucide-react'
import { useApi } from '../lib/api'
import { pushRecent } from '../lib/session'
import { EQUITY_BAND, fitsProfile, useClients, useMeetings, useProducts } from '../lib/data'
import { ago, date, inr, label, when } from '../lib/format'
import { AllocBar, Donut } from '../charts'
import { ASSET_COLORS, Avatar, Delta, DetailSkeleton, Drawer, Empty, SkeletonRows, Num, Panel, Stat, Status, TierPill, useToast } from '../ui'
import AgentPanel from '../agent/AgentPanel'
import { DrillCard, Change } from '../ui/Drill'
import { ProfilePanel } from './ClientProfile'
import { ActionsPanel, ContextBar, Timeline } from './shared'

const CONSENTS = [
  { key: 'whatsapp', label: 'WhatsApp' }, { key: 'email', label: 'Email' }, { key: 'profile_enrichment', label: 'Profile enrichment' },
  { key: 'marketing', label: 'Marketing' }, { key: 'data_sharing_with_partners', label: 'Sharing with partners' },
]

export default function ClientDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: c, error } = useApi<any>(`/c/clients/${id}`)
  useEffect(() => { if (c) pushRecent({ kind: 'client', id: c.id, title: c.name, sub: `${label(c.segment)} client · ${c.locality}` }) }, [c?.id])
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()
  const { data: meetings = [] } = useMeetings()
  const { data: ins } = useApi<any>(id ? `/clients/${id}/insights` : null)
  const panel = params.get('panel')
  const setPanel = (p: string | null, extra: Record<string, string> = {}) => setParams(p ? { panel: p, ...extra } : {})
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null)
  const toast = useToast()

  const P = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const names = useMemo(() => Object.fromEntries([...clients.map((x) => [x.id, x.name]), ...products.map((p) => [p.id, p.name])]), [clients, products])
  if (error) return <main className="page"><Empty title="Client not found" action={<Link className="btn btn-quiet" to="/clients">Back to clients</Link>} /></main>
  if (!c) return <DetailSkeleton />

  const momFor = params.get('mom') ? meetings.find((m) => m.id === params.get('mom')) : null
  const agentInitial = agentPrompt ?? (momFor ? `Log the MoM for "${momFor.title}" (${momFor.id}): ` : null)
  const family = clients.filter((x) => x.family_id === c.family_id && x.id !== c.id)
  const mine = meetings.filter((m) => m.with.id === c.id)
  const upcoming = mine.filter((m) => m.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))
  const gain = c.aum - c.invested
  const band = EQUITY_BAND[c.risk_profile]
  const eq = c.allocation?.Equity || 0
  const doCta = (cta: any) => {
    if (cta.do === 'service') setPanel('actions', { do: 'service', category: cta.category })
    else if (cta.do === 'schedule') setPanel('actions', { do: 'schedule' })
  }

  return (
    <main className="page has-ctxbar">
      <Link to="/clients" className="crumb"><ArrowLeft size={14} />Clients</Link>
      <header className="profile-head panel">
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          <Avatar name={c.name} photo={c.photo} size={68} />
          <div className="grow" style={{ minWidth: 0 }}>
            <h1>{c.name} <span className="client-code lg" title="Client code">{c.id}</span></h1>
            <p className="muted" style={{ marginTop: 4 }}>{c.family_role} in the <Link className="linkbtn" to={`/clients?view=families`}>{c.name.split(' ').slice(-1)[0]} family</Link>{[c.occupation, c.locality, `client since ${date(c.client_since, true)}`].filter(Boolean).map((x) => ` · ${x}`).join('')}</p>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <TierPill t={c.tier} />
              <Status s={c.segment} />
              <span className="pill outline" title={`Risk profile: ${c.risk_profile}, profiled on ${date(c.risk_profile_date, true)}`}>{c.risk_profile} · {date(c.risk_profile_date, true).replace(/^\d+ /, '')}</span>
              <span className="pill gain"><ShieldCheck size={12} />KYC {c.kyc.status}</span>
              {c.accounts.demat && <span className="pill outline">Demat</span>}
              {c.nominee === 'Missing' && <span className="pill loss">No nominee</span>}
              {c.tags.map((t: string) => <span key={t} className="pill">{t}</span>)}
            </div>
          </div>
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="label">With Kova</span>
            <span className="value l"><Num v={c.aum} /></span>
            <span className="sub">{c.invested > 0 ? <>{gain >= 0 ? <Delta v={(gain / Math.max(1, c.invested)) * 100} /> : null} · XIRR {c.xirr}%</> : 'Nothing invested yet'}</span>
          </div>
        </div>
        <div className="consent-strip">
          <span className="small strong row" style={{ gap: 6 }}><ShieldCheck size={15} color="var(--forest)" />Consent</span>
          {CONSENTS.map((k) => {
            const ok = c.consent[k.key]
            return <span key={k.key} className={`consent ${ok ? 'yes' : 'no'}`}>{ok ? <Check size={12} /> : <X size={12} />}{k.label}</span>
          })}
          <span className="tiny muted" style={{ marginLeft: 'auto' }}>{c.consent.version} · captured {date(c.consent.captured_on, true)}</span>
        </div>
      </header>

      <div className="grid g-main-wide" style={{ marginTop: 16 }}>
        <div className="col" style={{ gap: 16 }}>
          <Comparisons c={c} ins={ins} />
          <NeedsYou c={c} ins={ins} P={P} onDo={doCta} next={upcoming[0]} />
          {c.holdings.length > 0 && (
            <section className="panel drill-panel">
              <DrillCard title={<h2>Holdings</h2>} rootLabel="All holdings" clients={[c]} products={products} levels={['asset_class', 'product_type', 'subcategory', 'product']} src={`${c.first_name}'s holdings`} showClients={false} />
            </section>
          )}

          {c.goals?.length > 0 && (
            <Panel title="Goals" aside="As the client described them">
              <div className="grid g2">
                {c.goals.map((g: any) => (
                  <div key={g.name} className="sunk" style={{ padding: 14, background: 'var(--cream)' }}>
                    <div className="strong">{g.name}</div>
                    <div className="small muted">{inr(g.target)}{g.kind ? ` ${g.kind}` : ''} by {g.year}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Timeline" aside={`${c.timeline.length} entries`}>
            <Timeline items={c.timeline} />
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>
          {c.holdings.length === 0 ? (
          <Panel title="First portfolio">
            <p className="small">{c.first_name} has no investments with Kova yet{c.estimated_investable ? `; you estimated ${inr(c.estimated_investable)} to invest` : ''}. Start from a CIO model that suits a {c.risk_profile.toLowerCase()} profile.</p>
            <Link className="btn btn-primary" style={{ marginTop: 12 }} to={`/studio?new=1&tag=client:${c.id}`}>Build their first portfolio</Link>
          </Panel>
          ) : (
          <Panel title="Allocation" aside={<button className="linkbtn" onClick={() => setPanel('portfolio')}>Portfolio <ChevronRight size={14} /></button>}>
            <AllocBar parts={Object.entries(c.allocation as Record<string, number>).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
            <div className="col small" style={{ gap: 6, marginTop: 12 }}>
              {Object.entries(c.allocation as Record<string, number>).map(([k, v]) => <div key={k} className="spread"><span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: ASSET_COLORS[k] }} />{k}</span><span className="num">{v}%</span></div>)}
            </div>
            <p className={`small sev ${eq > band[1] ? 'high' : 'low'}`} style={{ marginTop: 12 }}>Equity {eq}% against a {band[0]}–{band[1]}% band for a {c.risk_profile.toLowerCase()} profile.</p>
          </Panel>
          )}

          <ProfilePanel c={c} onRequest={(category, what) => setPanel('actions', { do: 'service', category, ...(what ? { what } : {}) })} />

          {family.length > 0 && (
            <Panel title="Family">
              <div className="col" style={{ gap: 4 }}>
                {family.map((m) => (
                  <Link key={m.id} to={`/clients/${m.id}`} className="row small fam-member"><Avatar name={m.name} size={28} /><span className="grow">{m.name}<span className="tiny muted"> · {m.family_role}</span></span><span className="num">{inr(m.aum, { fixed: true })}</span></Link>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <ContextBar agentOn={panel === 'agent'} onAgent={() => setPanel(panel === 'agent' ? null : 'agent')}>
        <button className={`cb ${panel === 'portfolio' ? 'on' : ''}`} onClick={() => setPanel(panel === 'portfolio' ? null : 'portfolio')}><LayoutGrid />Portfolio</button>
        <button className={`cb ${panel === 'actions' ? 'on' : ''}`} onClick={() => setPanel(panel === 'actions' ? null : 'actions')}><ListChecks />Actions</button>
        <span className="sep" />
        <button className="cb minor" onClick={() => toast(<>Call {c.first_name} on {c.phone}. Calling from Kova arrives with telephony.</>)} title="Call" aria-label={`Call ${c.first_name}`}><Phone aria-hidden /></button>
        <button className="cb minor" onClick={() => setPanel('actions', { do: 'schedule' })} title="Schedule a meeting" aria-label="Schedule a meeting"><CalendarPlus aria-hidden /></button>
        <button className="cb minor" onClick={() => { setAgentPrompt(`Send the MoM from my last meeting with ${c.first_name} on ${c.consent.whatsapp ? 'WhatsApp' : 'email'}: `); setPanel('agent') }} title="Send the MoM" aria-label="Send the MoM from the last meeting"><MessageSquareText aria-hidden /></button>
        <button className="cb minor" onClick={() => setPanel('actions', { do: 'feedback' })} title="Give product feedback" aria-label="Give product feedback"><Send aria-hidden /></button>
        <button className="cb minor" onClick={() => setPanel('actions', { do: 'reimb' })} title="Claim a reimbursement" aria-label="Claim a reimbursement"><Receipt aria-hidden /></button>
      </ContextBar>

      {panel === 'portfolio' && <PortfolioPanel c={c} P={P} products={products} onClose={() => setPanel(null)} />}
      {panel === 'actions' && (
        <Drawer title="Actions" sub={c.name} onClose={() => setPanel(null)} scrim={false}>
          <ActionsPanel kind="client" id={c.id} name={c.name} initial={params.get('do')} onAskAgent={(p) => { setAgentPrompt(p); setPanel('agent') }} />
        </Drawer>
      )}
      {panel === 'agent' && <AgentPanel key={agentInitial || 'a'} scope={{ kind: 'client', id: c.id }} name={c.name} allowBill names={names} onClose={() => setPanel(null)} initialText={agentInitial} />}
    </main>
  )
}

function PortfolioPanel({ c, P, products, onClose }: { c: any; P: Record<string, any>; products: any[]; onClose: () => void }) {
  const groups: Record<string, any[]> = {}
  if (!products.length) return <Drawer wide scrim={false} title="Portfolio" sub={c.name} onClose={onClose}><SkeletonRows rows={5} /></Drawer>
  c.holdings.forEach((h: any) => (groups[h.asset_class] ||= []).push(h))
  const held = new Set(c.holdings.map((h: any) => h.product_id))
  const fits = products.filter((p) => !held.has(p.id) && p.cio_view.stance === 'Preferred' && fitsProfile(p, c.risk_profile) && p.min_investment <= c.aum * 0.25).slice(0, 4)
  const review = c.holdings.filter((h: any) => P[h.product_id]?.cio_view.stance === 'Under review')
  const band = EQUITY_BAND[c.risk_profile]
  const eq = c.allocation?.Equity || 0
  return (
    <Drawer wide scrim={false} title="Portfolio" sub={`${c.name} · ${inr(c.aum)} · ${c.holdings.length} holdings`} onClose={onClose}
      foot={<Link className="btn btn-primary" to={`/studio?new=1&tag=client:${c.id}`}>Build a proposal in Studio</Link>}>
      <div className="row" style={{ gap: 20, marginBottom: 18 }}>
        <Donut size={130} thick={16} data={Object.entries(c.allocation as Record<string, number>).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k], note: `${v}%` }))} center={<div><div className="display strong" style={{ fontSize: 18 }}>{inr(c.aum)}</div><div className="tiny muted">XIRR {c.xirr}%</div></div>} />
        <div className="grow col" style={{ gap: 8 }}>
          {eq > band[1] && <div className="sev high small">Equity at {eq}% is above the {band[1]}% ceiling for {c.risk_profile.toLowerCase()}. Consider a rebalance.</div>}
          {review.length > 0 && <div className="sev medium small">{review.length} holding{review.length > 1 ? 's are' : ' is'} under CIO review.</div>}
          {c.cash_flows.filter((f: any) => f.kind === 'Maturity').map((f: any, i: number) => <div key={i} className="sev low small">{inr(f.amount)} {P[f.product_id]?.name} matures {when(f.date).toLowerCase()}: plan the reinvestment.</div>)}
          {eq <= band[1] && !review.length && <div className="small muted">Allocation is within the band for this profile.</div>}
        </div>
      </div>
      {Object.entries(groups).map(([cls, hs]) => (
        <div key={cls} style={{ marginBottom: 16 }}>
          <div className="spread" style={{ marginBottom: 6 }}><h3 className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: ASSET_COLORS[cls] }} />{cls}</h3><span className="small num muted">{inr(hs.reduce((a, h) => a + h.value, 0), { fixed: true })}</span></div>
          <table className="table">
            <tbody>
              {hs.map((h) => {
                const p = P[h.product_id]
                const g = ((h.value - h.invested) / h.invested) * 100
                return (
                  <tr key={h.product_id}>
                    <td><Link to={`/products/${h.product_id}`} className="strong">{p?.name}</Link><div className="tiny muted">{p?.sub_category} · {h.mode}{h.sip_amount ? ` ${inr(h.sip_amount)}/month` : ''} · since {date(h.since, true)}</div></td>
                    <td className="r"><Num v={h.value} fixed /><div><Delta v={g} /></div></td>
                    <td className="r"><Status s={p?.cio_view.stance} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      <h3 style={{ margin: '20px 0 8px' }}>Worth a conversation</h3>
      <p className="tiny muted" style={{ marginBottom: 10 }}>CIO-preferred products that fit {c.first_name}’s risk profile and ticket size and that they don’t hold. Ranked by fit, never by points.</p>
      <div className="col" style={{ gap: 8 }}>
        {fits.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`} className="fit-row">
            <span className="grow"><span className="strong small">{p.name}</span><br /><span className="tiny muted">{p.sub_category} · risk {p.risk.toLowerCase()} · min {inr(p.min_investment)}</span></span>
            <span className="tiny muted" style={{ maxWidth: 220 }}>{p.cio_view.comment.split('.')[0]}.</span>
          </Link>
        ))}
      </div>
    </Drawer>
  )
}

/* Value, return against a benchmark blend, revenue against last year, and how often you've met */
function Comparisons({ c, ins }: { c: any; ins: any }) {
  const cmp = ins?.comparisons
  const gain = c.aum - c.invested
  const diff = cmp?.return_1y != null && cmp?.benchmark_1y != null ? cmp.return_1y - cmp.benchmark_1y : null
  return (
    <section className="panel">
      <div className="statline">
        <Stat label="Current value" value={<Num v={c.aum} />} sub={c.invested > 0 ? <span className="row" style={{ gap: 6 }}>{gain >= 0 ? '▲' : '▼'} <Num v={Math.abs(gain)} src="Current value minus cost" /> on <Num v={c.invested} src="Purchase cost" /> invested</span> : 'Nothing invested yet'} />
        <Stat label="Return, last 12 months" value={cmp?.return_1y != null ? <Num v={cmp.return_1y} src="Change in value net of money added (modified Dietz), sample history">{cmp.return_1y}%</Num> : '—'}
          sub={diff != null ? <span title={cmp.benchmark_name}><span className={`delta ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} pts</span> vs {cmp.benchmark_1y}% benchmark blend</span> : 'Needs a year of history'} />
        <Stat label="Revenue this fiscal year" value={<Num v={cmp?.revenue.fy ?? c.revenue_ytd} src="Trail and fees, sample data" />}
          sub={cmp ? <span className="row" style={{ gap: 6 }}><Change now={cmp.revenue.fy} prev={cmp.revenue.fy_before || undefined} /><span>vs same months last year · {inr(cmp.revenue.lifetime)} since {cmp.revenue.since ? date(cmp.revenue.since + '-01', true).replace(/^\d+ /, '') : 'joining'}</span></span> : null} />
        <Stat label="Meetings, last 90 days" value={cmp?.interactions.meetings_90d ?? '—'}
          sub={cmp ? <>{cmp.interactions.meetings_prev_90d} in the 90 days before · last contact {ago(c.last_contact)}</> : null} />
      </div>
    </section>
  )
}

/* Red flags say why they matter and offer the next step; actionables are what's coming in the next days and months */
function NeedsYou({ c, ins, P, onDo, next }: { c: any; ins: any; P: Record<string, any>; onDo: (cta: any) => void; next?: any }) {
  if (!ins) return null
  const { flags } = ins
  const soon = ins.actionables.some((a: any) => a.kind === 'meeting')
  const actionables = [...ins.actionables, ...(!soon && next ? [{ kind: 'next', title: `Next meeting: ${next.title}`, date: next.start, detail: next.location, cta: { label: 'Open the meeting', href: `/meetings?m=${next.id}` } }] : [])]
  if (!flags.length && !actionables.length) return null
  const cta = (x: any) => x.href ? <Link className="btn btn-quiet btn-sm" to={x.href}>{x.label}</Link> : <button className="btn btn-quiet btn-sm" onClick={() => onDo(x)}>{x.label}</button>
  return (
    <Panel title="Needs you" aside={flags.length ? `${flags.length} flag${flags.length > 1 ? 's' : ''}` : undefined}>
      <div className="col" style={{ gap: 0 }}>
        {flags.map((f: any) => (
          <div key={f.id} className="flag-row">
            <div className={`sev ${f.severity} grow`}><div className="strong small">{f.text}</div><div className="tiny muted" style={{ marginTop: 2 }}>{f.why}</div></div>
            {cta(f.cta)}
          </div>
        ))}
        {actionables.map((a: any, i: number) => (
          <div key={i} className="flag-row act">
            <div className="grow small">
              <div className="strong">{a.title}</div>
              <div className="tiny muted">
                {a.kind === 'cash_flows' ? <>{inr(a.inflow)} coming in, {inr(Math.abs(a.outflow))} going out · {a.detail}</>
                  : <>{a.date ? when(a.date) : ''}{a.amount ? ` · ${inr(a.amount)}` : ''}{a.detail ? ` · ${a.detail}` : ''}</>}
              </div>
            </div>
            {a.cta && cta(a.cta)}
          </div>
        ))}
      </div>
      {c.cash_flows?.length > 0 && <details className="tiny" style={{ marginTop: 8 }}><summary className="muted">All scheduled cash flows</summary>
        <div className="col" style={{ gap: 0, marginTop: 6 }}>{c.cash_flows.map((f: any, i: number) => <div key={i} className="spread" style={{ padding: '4px 0' }}><span>{f.kind}: {P[f.product_id]?.name} · {date(f.date)}</span><span className="num">{inr(f.amount, { fixed: true })}</span></div>)}</div>
      </details>}
    </Panel>
  )
}
