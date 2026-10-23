import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight, Plus, RotateCcw, Search } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { STAGES, STAGE_INFO, useProducts, useProspects, useMeetings, useModels } from '../lib/data'
import { ago, date, inr, when, daysFrom } from '../lib/format'
import { Columns, HBars } from '../charts'
import { Avatar, Modal, Num, Panel, Stat, useToast } from '../ui'

export default function Prospects() {
  const { data: prospects = [] } = useProspects()
  const { data: products = [] } = useProducts()
  const { data: meetings = [] } = useMeetings()
  const { data: models = [] } = useModels()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [sort, setSort] = useState('value')
  const [showClosed, setShowClosed] = useState(params.get('closed') === '1')
  const [creating, setCreating] = useState(params.get('new') === '1')
  const nav = useNavigate()
  const toast = useToast()
  const P = Object.fromEntries(products.map((p) => [p.id, p]))

  const open = prospects.filter((p) => p.stage !== 'Closed')
  const closed = prospects.filter((p) => p.stage === 'Closed')
  const potential = open.reduce((a, p) => a + p.estimated_investable, 0)
  const weighted = open.reduce((a, p) => a + (p.estimated_investable * p.probability) / 100, 0)
  const nextMeeting = (id: string) => meetings.filter((m) => m.with.id === id && m.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))[0]

  const list = useMemo(() => {
    const l = open.filter((p) => (!stage || p.stage === stage) && (!q || (p.name + p.need + p.source).toLowerCase().includes(q.toLowerCase())))
    return [...l].sort((a, b) => sort === 'value' ? b.estimated_investable - a.estimated_investable : sort === 'stale' ? a.last_contact.localeCompare(b.last_contact) : sort === 'next' ? (a.next_step_date || '9').localeCompare(b.next_step_date || '9') : b.probability - a.probability)
  }, [open, stage, q, sort])

  const opps = useMemo(() => {
    const o: { text: string; action: string; to: string }[] = []
    open.filter((p) => p.app_activity?.length).forEach((p) => o.push({ text: `${p.name}: ${p.app_activity[0].text} in Kova Client.`, action: 'Send a nudge', to: `/prospects/${p.id}?panel=agent&ask=nudge` }))
    open.filter((p) => (daysFrom(p.last_contact) ?? 0) <= -30).slice(0, 2).forEach((p) => o.push({ text: `No contact with ${p.name} for ${-daysFrom(p.last_contact)!} days. ${inr(p.estimated_investable)} potential.`, action: 'Schedule a meeting', to: `/prospects/${p.id}?panel=actions&do=schedule` }))
    const close = open.filter((p) => p.probability >= 65)
    if (close.length) o.push({ text: `${close.length} prospects are close to converting: ${close.map((p) => p.name.split(' ')[0]).join(', ')}.`, action: 'See them', to: '/prospects?sort=prob' })
    const fitModel = models.find((m) => m.id === 'MP-03')
    const fitters = open.filter((p) => ['Moderate', 'Not assessed'].includes(p.risk_indication) && p.estimated_investable >= 5e6)
    if (fitModel && fitters.length >= 2) o.push({ text: `The ${fitModel.name} model fits ${fitters.length} prospects in your list (${fitters.slice(0, 3).map((p) => p.name.split(' ')[0]).join(', ')}).`, action: 'Open in Studio', to: `/studio?new=1&model=${fitModel.id}` })
    const kyc = open.filter((p) => p.stage === 'KYC in progress')
    kyc.forEach((p) => { const pending = p.kyc_steps.filter((s: any) => !s.done).slice(0, 2).map((s: any) => s.step); if (pending.length) o.push({ text: `${p.name} is waiting on ${pending.join(' and ')}.`, action: 'Follow up', to: `/prospects/${p.id}?panel=agent&ask=kyc` }) })
    const newP = products.filter((x) => x.is_new && x.cio_view.stance !== 'Under review')[0]
    const newFit = newP && open.filter((p) => p.interests.some((i: string) => P[i]?.category === newP.category))
    if (newP && newFit?.length) o.push({ text: `New on the shelf: ${newP.name} suits ${newFit.length} prospects who are interested in ${newP.category.toLowerCase()}s.`, action: 'View product', to: `/products/${newP.id}` })
    return o.slice(0, 7)
  }, [open, products, models])

  const srcMap: Record<string, number> = {}
  prospects.forEach((p) => { srcMap[p.source] = (srcMap[p.source] || 0) + p.estimated_investable })
  const sources = Object.entries(srcMap).sort((a, b) => b[1] - a[1])
  const suggestions = open.flatMap((p) => p.suggestions.map((s: any) => ({ ...s, p })))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Prospects</h1>
          <p className="lede">{open.length} people in your pipeline worth {inr(potential)}, about {inr(weighted)} weighted by how likely each is to convert.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus />Add a prospect</button>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="statline">
          <Stat label="Open prospects" value={open.length} sub={`${open.filter((p) => p.stage === 'Lead').length} still leads`} />
          <Stat label="Potential" value={<Num v={potential} src="RM estimates" />} sub="Estimated investable" />
          <Stat label="Weighted pipeline" value={<Num v={weighted} src="Estimate × stage probability" />} sub="By stage probability" />
          <Stat label="Conversion, last 12 months" value="32%" sub="8 of 25 became clients" />
          <Stat label="Average time to convert" value="41 days" sub="From first meeting" />
        </div>
      </section>

      <div className="grid g-main" style={{ marginBottom: 16 }}>
        <Panel title="Opportunities" aside="Each one is a single click away">
          <div className="col" style={{ gap: 0 }}>
            {opps.map((o, i) => (
              <div key={i} className="suggest-item">
                <span className="ring" style={{ marginTop: 5 }} />
                <p className="grow small">{o.text}</p>
                <button className="btn btn-quiet btn-sm" onClick={() => nav(o.to)}>{o.action}<ArrowRight /></button>
              </div>
            ))}
          </div>
        </Panel>
        <div className="col" style={{ gap: 16 }}>
          <Panel title="Pipeline by stage">
            <Columns height={110} highlightLast={false} data={STAGES.map((s) => ({ label: s.replace('Investing and trading client', 'Inv + trading').replace('Investing client', 'Investing').replace('KYC in progress', 'KYC'), value: open.filter((p) => p.stage === s).length }))} />
          </Panel>
          <Panel title="Where they come from">
            <HBars data={sources.map(([k, v]) => ({ label: k, value: v }))} format={(v) => inr(v)} />
          </Panel>
        </div>
      </div>

      {suggestions.length > 0 && (
        <Panel title="From the product and CIO teams" aside={`${suggestions.length} suggestions`} className="mb16">
          <div className="grid g3">
            {suggestions.slice(0, 6).map((s, i) => (
              <Link key={i} to={`/prospects/${s.p.id}`} className="note-card">
                <div className="tiny muted">{s.from.name}, {s.from.title} · {date(s.date)}</div>
                <div className="small strong" style={{ margin: '4px 0' }}>{s.p.name} → {P[s.product_id]?.name}</div>
                <div className="small">{s.text}</div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="list-toolbar">
          <label className="searchbox" style={{ height: 34, maxWidth: 260 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, need or source" style={{ border: 0, outline: 0, background: 'transparent', width: '100%' }} /></label>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip ${!stage ? 'on' : ''}`} onClick={() => setStage('')}>All open</button>
            {STAGES.map((s) => <button key={s} title={STAGE_INFO[s]} className={`chip ${stage === s ? 'on' : ''}`} onClick={() => setStage(s)}>{s}</button>)}
          </div>
          <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 180, marginLeft: 'auto' }} aria-label="Sort">
            <option value="value">Largest first</option><option value="prob">Most likely first</option><option value="next">Next step date</option><option value="stale">Longest since contact</option>
          </select>
        </div>
        {list.map((p) => <ProspectRow key={p.id} p={p} next={nextMeeting(p.id)} />)}
        {list.length === 0 && <div className="empty">No open prospects match.</div>}

        <button className="closed-toggle" onClick={() => { setShowClosed((s) => !s); setParams(showClosed ? {} : { closed: '1' }) }}>
          {showClosed ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Closed prospects <span className="tiny muted">({closed.length}) · kept on record, can be reopened</span>
        </button>
        {showClosed && closed.map((p) => (
          <div key={p.id} className="client-row closed">
            <Avatar name={p.name} size={40} />
            <div className="cr-name"><Link to={`/prospects/${p.id}`} className="strong">{p.name}</Link><div className="tiny muted">{p.source} · closed {date(p.closed?.date)}</div></div>
            <div className="cr-aum small num">{inr(p.estimated_investable)}</div>
            <div className="cr-next small">{p.closed?.reason}</div>
            <div className="cr-flags tiny muted">Learning: {p.closed?.learning || '—'}</div>
            <button className="btn btn-quiet btn-sm" onClick={async () => { await api(`/prospects/${p.id}/reopen`, { method: 'POST' }); invalidate('/c/prospects'); toast(`${p.name} reopened`) }}><RotateCcw />Reopen</button>
          </div>
        ))}
      </section>

      {creating && <CreateProspect onClose={() => { setCreating(false); setParams({}) }} onCreated={(id) => nav(`/prospects/${id}`)} />}
    </main>
  )
}

function ProspectRow({ p, next }: { p: any; next?: any }) {
  const stale = (daysFrom(p.last_contact) ?? 0) <= -30
  return (
    <Link to={`/prospects/${p.id}`} className="client-row">
      <Avatar name={p.name} size={46} />
      <div className="cr-name">
        <div className="strong">{p.name}</div>
        <div className="tiny muted">{p.source}{p.source_detail ? `: ${p.source_detail}` : ''}</div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}><span className="pill forest" title={STAGE_INFO[p.stage]}>{p.stage}</span>{p.app_access && <span className="pill outline">On Kova Client</span>}</div>
      </div>
      <div className="cr-aum">
        <div className="display strong" style={{ fontSize: 17 }}><Num v={p.estimated_investable} src="RM estimate" /></div>
        <div className="tiny muted">{p.probability}% likely</div>
      </div>
      <div className="cr-next">
        {next ? <><div className="tiny muted">Meeting</div><div className="small">{next.title}</div><div className="tiny muted">{when(next.start)}</div></>
          : p.next_step ? <><div className="tiny muted">Next step</div><div className="small">{p.next_step}</div><div className={`tiny ${(daysFrom(p.next_step_date) ?? 1) < 0 ? 'u-overdue-l' : 'muted'}`}>{when(p.next_step_date)}</div></> : <span className="tiny faint">No next step</span>}
      </div>
      <div className="cr-flags">
        <div className="tiny muted ellipsis2">{p.need}</div>
        <div className={`tiny ${stale ? 'sev medium' : 'faint'}`} style={{ marginTop: 4 }}>Last contact {ago(p.last_contact)}</div>
      </div>
      <ChevronRight className="cr-go" size={18} />
    </Link>
  )
}

function CreateProspect({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', source: 'Referral', source_detail: '', estimated_investable: 5000000, need: '', stage: 'Lead', next_step: 'Intro call', next_step_date: '' })
  const toast = useToast()
  const set = (k: string, v: any) => setF({ ...f, [k]: v })
  const save = async () => {
    const p = await api('/prospects', { body: f })
    invalidate('/c/prospects')
    toast(`${p.name} added as a ${p.stage.toLowerCase()}`)
    onCreated(p.id)
  }
  return (
    <Modal title="Add a prospect" sub="Everything here comes from you. The prospect doesn’t see it." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name.trim()} onClick={save}>Add prospect</button></>}>
      <div className="grid g2" style={{ gap: 12 }}>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Name</span><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Mobile</span><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field"><span>Email</span><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label className="field"><span>Source</span><select className="select" value={f.source} onChange={(e) => set('source', e.target.value)}>{['Referral', 'Event', 'Inbound', 'Cold outreach'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Referred by or where you met</span><input className="input" value={f.source_detail} onChange={(e) => set('source_detail', e.target.value)} /></label>
        <label className="field"><span>Estimated investable (₹)</span><input className="input" type="number" value={f.estimated_investable} onChange={(e) => set('estimated_investable', +e.target.value)} /></label>
        <label className="field"><span>Stage</span><select className="select" value={f.stage} onChange={(e) => set('stage', e.target.value)}><option>Lead</option><option>Prospect</option></select></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>What they need</span><textarea className="textarea" rows={2} value={f.need} onChange={(e) => set('need', e.target.value)} /></label>
        <label className="field"><span>Next step</span><input className="input" value={f.next_step} onChange={(e) => set('next_step', e.target.value)} /></label>
        <label className="field"><span>By</span><input className="input" type="date" value={f.next_step_date} onChange={(e) => set('next_step_date', e.target.value)} /></label>
        <label className="check toggle-off" style={{ gridColumn: '1 / -1' }} title="Arrives with Kova Client onboarding">
          <input type="checkbox" disabled /> <span>Create Kova Client access <span className="tiny muted">(sends a secure set-up link; not active in this version)</span></span>
        </label>
      </div>
    </Modal>
  )
}
