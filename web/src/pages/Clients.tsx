import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, UserPlus, Users } from 'lucide-react'
import { useClients, useFamilies, useMeetings, useProducts, useProspects } from '../lib/data'
import { SEGMENTS, RISK_ORDER, EQUITY_BAND } from '../lib/data'
import { ago, inr, label, when } from '../lib/format'
import { Donut, HBars, AllocBar } from '../charts'
import { ASSET_COLORS, Avatar, LoadError, Modal, Num, Panel, SkeletonRows, Status, Stat, SearchField } from '../ui'

export default function Clients() {
  const { data: clients = [], loading, error, reload } = useClients()
  const { data: families = [] } = useFamilies()
  const { data: meetings = [] } = useMeetings()
  const { data: products = [] } = useProducts()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('aum')
  const [risk, setRisk] = useState('')
  const [view, setView] = useState<'people' | 'families'>('people')
  const [onboard, setOnboard] = useState(params.get('onboard') === '1')
  const seg = params.get('segment') || ''
  const nav = useNavigate()

  const nextMeeting = (id: string) => meetings.filter((m) => m.with.id === id && m.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))[0]
  const live = clients.filter((c) => c.segment !== 'lost')
  const aum = clients.reduce((a, c) => a + c.aum, 0)
  const rev = clients.reduce((a, c) => a + (c.revenue_ytd || 0), 0)
  const inv = clients.reduce((a, c) => a + c.invested, 0)
  const flagged = clients.filter((c) => c.red_flags.some((f: any) => f.severity === 'high'))

  const list = useMemo(() => {
    let l = clients.filter((c) => (!seg || c.segment === seg) && (!risk || c.risk_profile === risk) && (!q || (c.name + c.locality + c.occupation).toLowerCase().includes(q.toLowerCase())))
    const nm = (c: any) => nextMeeting(c.id)?.start || '9999'
    l = [...l].sort((a, b) => sort === 'aum' ? b.aum - a.aum : sort === 'name' ? a.name.localeCompare(b.name) : sort === 'contact' ? a.last_contact.localeCompare(b.last_contact) : sort === 'next' ? nm(a).localeCompare(nm(b)) : b.red_flags.length - a.red_flags.length)
    return l
  }, [clients, seg, risk, q, sort, meetings])

  const suggestions = useMemo(() => {
    if (!clients.length) return []
    const s: { text: string; action: string; to: string }[] = []
    const dormant = clients.filter((c) => c.segment === 'dormant').sort((a, b) => b.aum - a.aum)
    if (dormant[0]) s.push({ text: `${dormant[0].name} hasn’t heard from you since ${ago(dormant[0].last_contact)}. ${inr(dormant[0].aum)} at stake.`, action: 'Schedule a check-in', to: `/clients/${dormant[0].id}?panel=actions&do=schedule` })
    const review = clients.filter((c) => c.holdings.some((h: any) => h.product_id === 'PD-104'))
    if (review.length) s.push({ text: `${review.length} clients hold Indus Peak Small Cap, which the CIO has under review.`, action: 'Read the CIO note', to: '/products/PD-104' })
    const drift = clients.filter((c) => c.allocation?.Equity > EQUITY_BAND[c.risk_profile][1])
    if (drift.length) s.push({ text: `${drift.map((c) => c.first_name).slice(0, 3).join(', ')}${drift.length > 3 ? ` and ${drift.length - 3} more` : ''} are above their equity band after the rally.`, action: 'Build a rebalance', to: `/studio?new=1&tag=client:${drift[0].id}` })
    const noNominee = clients.filter((c) => c.nominee === 'Missing')
    if (noNominee.length) s.push({ text: `${noNominee.length} clients have no nominee registered.`, action: 'See who', to: '/clients?segment=' })
    const fd = clients.flatMap((c) => c.cash_flows.filter((f: any) => f.kind === 'Maturity').map((f: any) => ({ c, f }))).sort((a, b) => a.f.date.localeCompare(b.f.date))[0]
    if (fd) s.push({ text: `${inr(fd.f.amount)} FD matures for ${fd.c.name} ${when(fd.f.date).toLowerCase()}.`, action: 'Plan the reinvestment', to: `/clients/${fd.c.id}?panel=portfolio` })
    return s
  }, [clients])

  const segData = SEGMENTS.map((s) => ({ label: s.label, value: clients.filter((c) => c.segment === s.key).length, color: s.color }))
  const byRisk = RISK_ORDER.map((r) => ({ label: r, value: clients.filter((c) => c.risk_profile === r).reduce((a, c) => a + c.aum, 0) }))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="lede">{live.length} clients and {inr(aum)} in your care. {flagged.length ? `${flagged.length} need attention this week.` : 'Nothing urgent.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOnboard(true)}><UserPlus />Onboard a client</button>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="statline">
          <Stat label="Assets under care" value={<Num v={aum} src="Sum of client holdings" />} sub={<span className="delta up">▲ {(((aum - inv) / inv) * 100).toFixed(1)}% over invested</span>} />
          <Stat label="Active clients" value={clients.filter((c) => c.segment === 'active').length} sub={`of ${clients.length} on record`} />
          <Stat label="Net new money, this quarter" value={<Num v={69000000} src="Purchases minus redemptions, mock" />} sub="46% of the ₹15 Cr goal" />
          <Stat label="Revenue this year" value={<Num v={rev} src="Trail and advisory fees, mock" />} sub={`${((rev / aum) * 100).toFixed(2)}% yield on assets`} />
          <Stat label="Average XIRR" value={`${(live.reduce((a, c) => a + c.xirr, 0) / Math.max(1, live.length)).toFixed(1)}%`} sub="Since each client joined" />
        </div>
      </section>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Panel title="Client health" aside="Segment rules below">
          <div className="row" style={{ gap: 20, alignItems: 'center' }}>
            <Donut data={segData} size={140} center={<div><div className="display" style={{ fontSize: 24, color: 'var(--ink-strong)' }}>{clients.length}</div><div className="tiny muted">clients</div></div>} />
            <div className="grow col" style={{ gap: 8 }}>
              {SEGMENTS.map((s) => (
                <button key={s.key} className="spread small" onClick={() => setParams(seg === s.key ? {} : { segment: s.key })} title={s.rule} style={{ textAlign: 'left', opacity: seg && seg !== s.key ? 0.45 : 1 }}>
                  <span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />{s.label}</span>
                  <span className="num strong">{clients.filter((c) => c.segment === s.key).length}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>Active: transacted in 6 months. Engaged: in touch, no transaction. Dormant: no contact or transaction in 6 months. Lost: fully redeemed.</p>
        </Panel>
        <Panel title="Assets by risk profile">
          <HBars data={byRisk.map((r) => ({ label: r.label, value: r.value }))} format={(v) => inr(v)} />
        </Panel>
        <Panel title="Red flags" aside={`${clients.reduce((a, c) => a + c.red_flags.length, 0)} open`}>
          <div className="col" style={{ gap: 10, maxHeight: 214, overflowY: 'auto' }}>
            {clients.flatMap((c) => c.red_flags.map((f: any) => ({ c, f }))).sort((a, b) => ['high', 'medium', 'low'].indexOf(a.f.severity) - ['high', 'medium', 'low'].indexOf(b.f.severity)).slice(0, 10).map(({ c, f }, i) => (
              <Link key={i} to={`/clients/${c.id}`} className={`sev ${f.severity} small`}>
                <span className="strong">{c.name}</span> <span className="muted">· {f.text}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="What to do next" aside="From your book today" className="suggest-panel">
        <div className="suggest">
          {suggestions.map((s, i) => (
            <div key={i} className="suggest-item">
              <span className="ring" style={{ marginTop: 5 }} />
              <p className="grow small">{s.text}</p>
              <button className="btn btn-quiet btn-sm" onClick={() => nav(s.to)}>{s.action}<ArrowRight /></button>
            </div>
          ))}
        </div>
      </Panel>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="list-toolbar">
          <div className="seg" role="group" aria-label="View">
            <button className={view === 'people' ? 'on' : ''} aria-pressed={view === 'people'} onClick={() => setView('people')}>Individuals</button>
            <button className={view === 'families' ? 'on' : ''} aria-pressed={view === 'families'} onClick={() => setView('families')}>Families</button>
          </div>
          <SearchField value={q} onChange={setQ} placeholder="Name, area or occupation…" label="Search clients" width={280} />
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip ${!seg ? 'on' : ''}`} aria-pressed={!seg} onClick={() => setParams({})}>All</button>
            {SEGMENTS.map((s) => <button key={s.key} className={`chip ${seg === s.key ? 'on' : ''}`} aria-pressed={seg === s.key} onClick={() => setParams({ segment: s.key })}>{s.label}</button>)}
          </div>
          <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
            <select className="select sm" value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Risk profile" style={{ width: 190 }}>
              <option value="">Any risk profile</option>
              {RISK_ORDER.map((r) => <option key={r}>{r}</option>)}
            </select>
            <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{ width: 170 }}>
              <option value="aum">Largest first</option>
              <option value="flags">Most red flags</option>
              <option value="contact">Longest since contact</option>
              <option value="next">Next meeting</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>

        {error && !clients.length ? <LoadError what="clients" onRetry={reload} /> : loading && !clients.length ? <SkeletonRows rows={6} height={78} /> : view === 'people' ? (
          <div>
            {list.map((c) => {
              const nm = nextMeeting(c.id)
              return (
                <Link key={c.id} to={`/clients/${c.id}`} className="client-row">
                  <Avatar name={c.name} photo={c.photo} size={46} />
                  <div className="cr-name">
                    <div className="strong">{c.name}</div>
                    <div className="tiny muted">{c.family_role} · {c.occupation} · {c.locality}</div>
                    <div className="row" style={{ gap: 6, marginTop: 6 }}><Status s={c.segment} /><span className="pill outline">{c.risk_profile}</span></div>
                  </div>
                  <div className="cr-aum">
                    <div className="display strong" style={{ fontSize: 17 }}><Num v={c.aum} /></div>
                    <div style={{ width: 120, margin: '6px 0 4px' }}><AllocBar parts={Object.entries(c.allocation as Record<string, number>).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} /></div>
                    <div className="tiny muted">XIRR {c.xirr}%</div>
                  </div>
                  <div className="cr-next">
                    {nm ? <><div className="tiny muted">Next</div><div className="small">{nm.title}</div><div className="tiny muted">{when(nm.start)}</div></>
                      : <><div className="tiny muted">Last contact</div><div className="small">{ago(c.last_contact)}</div></>}
                  </div>
                  <div className="cr-flags">
                    {c.red_flags.slice(0, 2).map((f: any, i: number) => <div key={i} className={`sev ${f.severity} tiny`}>{f.text}</div>)}
                    {c.red_flags.length === 0 && <span className="tiny faint">No flags</span>}
                  </div>
                  <ChevronRight className="cr-go" size={18} />
                </Link>
              )
            })}
            {list.length === 0 && <div className="empty">No clients match these filters.</div>}
          </div>
        ) : (
          <div className="grid g3" style={{ padding: 16 }}>
            {families.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.aum - a.aum).map((f) => {
              const members = clients.filter((c) => c.family_id === f.id)
              return (
                <div key={f.id} className="sunk" style={{ padding: 16, background: 'var(--cream)' }}>
                  <div className="spread"><h3>{f.name}</h3><span className="display strong"><Num v={f.aum} /></span></div>
                  <div className="tiny muted" style={{ marginBottom: 12 }}>{f.business} · {f.locality}</div>
                  <div className="col" style={{ gap: 6 }}>
                    {members.map((m) => (
                      <Link key={m.id} to={`/clients/${m.id}`} className="row small fam-member">
                        <Avatar name={m.name} size={26} />
                        <span className="grow">{m.name} <span className="muted tiny">· {m.family_role}</span></span>
                        <span className="num">{inr(m.aum)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {onboard && <Onboard onClose={() => { setOnboard(false); if (params.get('onboard')) setParams({}) }} />}
    </main>
  )
}

/* C4: screen only. From a prospect shows the step-through; nothing is saved. */
function Onboard({ onClose }: { onClose: () => void }) {
  const { data: prospects = [] } = useProspects()
  const [mode, setMode] = useState<'choose' | 'prospect' | 'new'>('choose')
  const [step, setStep] = useState(0)
  const [pick, setPick] = useState<any>(null)
  const open = prospects.filter((p) => p.stage !== 'Closed')
  const steps = ['Pick prospect', 'Review details', 'KYC checklist', 'Done']
  return (
    <Modal wide title="Onboard a client" sub="Screen preview: no records change in this version." onClose={onClose}
      foot={mode === 'prospect' && step < 3 ? (
        <>
          {step > 0 && <button className="btn btn-quiet" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn btn-primary" disabled={!pick} onClick={() => setStep(step + 1)}>{step === 2 ? 'Submit for verification' : 'Continue'}</button>
        </>
      ) : mode === 'new' ? <button className="btn btn-primary" disabled title="Screen only in this version">Create client</button> : undefined}>
      {mode === 'choose' && (
        <div className="grid g2">
          <button className="choice" onClick={() => setMode('prospect')}>
            <Users /><h3>From a prospect</h3><p className="small muted">Convert someone already in your pipeline. Their details carry over.</p>
          </button>
          <button className="choice" onClick={() => setMode('new')}>
            <UserPlus /><h3>New client</h3><p className="small muted">Start a fresh record and send the onboarding link.</p>
          </button>
        </div>
      )}
      {mode === 'prospect' && (
        <>
          <ol className="stepper">{steps.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''}><span>{i < step ? <Check size={12} /> : i + 1}</span>{s}</li>)}</ol>
          {step === 0 && (
            <div className="col" style={{ gap: 0, margin: '0 -20px' }}>
              {open.map((p) => (
                <button key={p.id} className="list-row" style={{ textAlign: 'left', background: pick?.id === p.id ? 'var(--brass-wash)' : undefined }} onClick={() => setPick(p)}>
                  <Avatar name={p.name} size={32} />
                  <span className="grow"><span className="strong">{p.name}</span><br /><span className="tiny muted">{p.stage} · {inr(p.estimated_investable)} · {p.need}</span></span>
                  {pick?.id === p.id && <Check size={16} color="var(--forest)" />}
                </button>
              ))}
            </div>
          )}
          {step === 1 && pick && (
            <dl className="kv">
              <dt>Name</dt><dd>{pick.name}</dd><dt>Mobile</dt><dd>{pick.phone}</dd><dt>Email</dt><dd>{pick.email}</dd>
              <dt>City</dt><dd>{pick.city}</dd><dt>Source</dt><dd>{pick.source} ({pick.source_detail})</dd>
              <dt>Investable</dt><dd>{inr(pick.estimated_investable)}</dd><dt>Risk indication</dt><dd>{pick.risk_indication}</dd>
              <dt>Account type</dt><dd><select className="select sm" style={{ width: 280 }} defaultValue="invest"><option value="invest">Investing (mutual funds, bonds, FDs)</option><option>Investing and trading (adds demat)</option></select></dd>
            </dl>
          )}
          {step === 2 && pick && (
            <div className="col" style={{ gap: 8 }}>
              {pick.kyc_steps.map((s: any) => (
                <div key={s.step} className="spread small" style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                  <span>{s.step}</span>{s.done ? <span className="pill gain">Done</span> : <span className="pill warn">Client to complete</span>}
                </div>
              ))}
            </div>
          )}
          {step === 3 && pick && (
            <div className="empty">
              <span className="ring lg" />
              <h3 style={{ marginTop: 10 }}>{pick.name} is pending verification</h3>
              <p className="small">In the full release, Kova Client sends the onboarding link and Operations verifies KYC. Nothing was changed in this preview.</p>
            </div>
          )}
        </>
      )}
      {mode === 'new' && (
        <div className="grid g2">
          {['Full name', 'Mobile', 'Email', 'PAN', 'City', 'Occupation'].map((f) => <label key={f} className="field"><span>{f}</span><input className="input" /></label>)}
          <p className="tiny muted" style={{ gridColumn: '1 / -1' }}>Screen only. Real onboarding with KYC, FATCA and bank verification comes in the full MVP.</p>
        </div>
      )}
    </Modal>
  )
}
