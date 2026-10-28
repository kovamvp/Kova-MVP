import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Check, ChevronRight, LayoutGrid, ListChecks, MessageSquareText, Phone, Receipt, Send, ShieldCheck, X } from 'lucide-react'
import { useApi } from '../lib/api'
import { EQUITY_BAND, fitsProfile, useClients, useMeetings, useProducts } from '../lib/data'
import { ago, date, inr, label, when } from '../lib/format'
import { AllocBar, Donut } from '../charts'
import { ASSET_COLORS, Avatar, Delta, DetailSkeleton, Drawer, Empty, SkeletonRows, Num, Panel, Stat, Status, useToast } from '../ui'
import AgentPanel from '../agent/AgentPanel'
import { ActionsPanel, ContextBar, Timeline } from './shared'

const CONSENTS = [
  { key: 'whatsapp', label: 'WhatsApp' }, { key: 'email', label: 'Email' }, { key: 'profile_enrichment', label: 'Profile enrichment' },
  { key: 'marketing', label: 'Marketing' }, { key: 'data_sharing_with_partners', label: 'Sharing with partners' },
]

export default function ClientDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: c, error } = useApi<any>(`/c/clients/${id}`)
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()
  const { data: meetings = [] } = useMeetings()
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

  return (
    <main className="page has-ctxbar">
      <Link to="/clients" className="crumb"><ArrowLeft size={14} />Clients</Link>
      <header className="profile-head panel">
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          <Avatar name={c.name} photo={c.photo} size={68} />
          <div className="grow" style={{ minWidth: 0 }}>
            <h1>{c.name}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{c.family_role} in the <Link className="linkbtn" to={`/clients?view=families`}>{c.name.split(' ')[1]} family</Link> · {c.occupation} · {c.locality} · client since {date(c.client_since, true)}</p>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <Status s={c.segment} />
              <span className="pill outline">Risk: {c.risk_profile}, profiled {date(c.risk_profile_date, true)}</span>
              <span className="pill gain"><ShieldCheck size={12} />KYC {c.kyc.status}</span>
              {c.accounts.demat && <span className="pill outline">Demat</span>}
              {c.nominee === 'Missing' && <span className="pill loss">No nominee</span>}
              {c.tags.map((t: string) => <span key={t} className="pill brass">{t}</span>)}
            </div>
          </div>
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="label">With Kova</span>
            <span className="value l"><Num v={c.aum} /></span>
            <span className="sub">{gain >= 0 ? <Delta v={(gain / Math.max(1, c.invested)) * 100} /> : null} · XIRR {c.xirr}%</span>
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
          <section className="panel">
            <div className="statline">
              <Stat label="Invested" value={<Num v={c.invested} src="Purchase cost" />} />
              <Stat label="Current value" value={<Num v={c.aum} />} />
              <Stat label="Gain" value={<span style={{ color: gain >= 0 ? 'var(--gain)' : 'var(--loss)' }}><Num v={gain} src="Current value minus cost" /></span>} />
              <Stat label="Revenue this year" value={<Num v={c.revenue_ytd} src="Trail and fees, mock" />} />
            </div>
          </section>

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
          <Panel title="Allocation" aside={<button className="linkbtn" onClick={() => setPanel('portfolio')}>Portfolio <ChevronRight size={14} /></button>}>
            <AllocBar parts={Object.entries(c.allocation as Record<string, number>).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
            <div className="col small" style={{ gap: 6, marginTop: 12 }}>
              {Object.entries(c.allocation as Record<string, number>).map(([k, v]) => <div key={k} className="spread"><span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: ASSET_COLORS[k] }} />{k}</span><span className="num">{v}%</span></div>)}
            </div>
            <p className={`small sev ${eq > band[1] ? 'high' : 'low'}`} style={{ marginTop: 12 }}>Equity {eq}% against a {band[0]}–{band[1]}% band for a {c.risk_profile.toLowerCase()} profile.</p>
          </Panel>

          <Panel title="Coming up">
            {upcoming.length === 0 && c.cash_flows.length === 0 && <p className="small muted">Nothing scheduled.</p>}
            <div className="col" style={{ gap: 0 }}>
              {upcoming.slice(0, 3).map((m) => (
                <Link key={m.id} to={`/meetings?m=${m.id}`} className="w-line"><CalendarPlus size={15} color="var(--forest)" /><span className="grow small">{m.title}<br /><span className="tiny muted">{when(m.start)} · {m.location}</span></span></Link>
              ))}
              {c.cash_flows.slice(0, 4).map((f: any, i: number) => (
                <div key={i} className="w-line small"><span className="grow">{f.kind}: {P[f.product_id]?.name}<br /><span className="tiny muted">{when(f.date)}</span></span><span className="num" style={{ color: f.amount < 0 ? 'var(--muted)' : 'var(--ink-strong)' }}>{inr(f.amount)}</span></div>
              ))}
            </div>
          </Panel>

          {c.red_flags.length > 0 && (
            <Panel title="Red flags">
              <div className="col" style={{ gap: 8 }}>{c.red_flags.map((f: any, i: number) => <div key={i} className={`sev ${f.severity} small`}>{f.text}</div>)}</div>
            </Panel>
          )}

          <Panel title="About">
            <p className="small" style={{ marginBottom: 12 }}>{c.notes_summary}</p>
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Mobile</dt><dd>{c.phone}</dd><dt>Email</dt><dd className="ellipsis">{c.email}</dd><dt>Age</dt><dd>{c.age}</dd>
              <dt>PAN</dt><dd>{c.pan_masked}</dd><dt>Last contact</dt><dd>{ago(c.last_contact)}</dd><dt>Nominee</dt><dd>{c.nominee}</dd>
              <dt>Interests</dt><dd>{c.consent.profile_enrichment ? c.interests.join(', ') : <span className="muted">Not recorded: no profile-enrichment consent</span>}</dd>
            </dl>
          </Panel>

          {family.length > 0 && (
            <Panel title="Family">
              <div className="col" style={{ gap: 4 }}>
                {family.map((m) => (
                  <Link key={m.id} to={`/clients/${m.id}`} className="row small fam-member"><Avatar name={m.name} size={28} /><span className="grow">{m.name}<span className="tiny muted"> · {m.family_role}</span></span><span className="num">{inr(m.aum)}</span></Link>
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
        <button className="cb minor" onClick={() => { setAgentPrompt(null); setPanel('agent'); toast('Attach the bill with the paperclip, or describe the expense.') }} title="Add a reimbursement" aria-label="Add a reimbursement"><Receipt aria-hidden /></button>
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
          <div className="spread" style={{ marginBottom: 6 }}><h3 className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: ASSET_COLORS[cls] }} />{cls}</h3><span className="small num muted">{inr(hs.reduce((a, h) => a + h.value, 0))}</span></div>
          <table className="table">
            <tbody>
              {hs.map((h) => {
                const p = P[h.product_id]
                const g = ((h.value - h.invested) / h.invested) * 100
                return (
                  <tr key={h.product_id}>
                    <td><Link to={`/products/${h.product_id}`} className="strong">{p?.name}</Link><div className="tiny muted">{p?.sub_category} · {h.mode}{h.sip_amount ? ` ${inr(h.sip_amount)}/month` : ''} · since {date(h.since, true)}</div></td>
                    <td className="r"><Num v={h.value} /><div><Delta v={g} /></div></td>
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
