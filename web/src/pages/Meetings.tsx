import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, NotebookPen, Pencil, UserX, Users, XCircle } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { TIERS, useClients, useMeetings, useProducts, useProspects } from '../lib/data'
import { date, inr, nowISO, parse, time, todayISO, when } from '../lib/format'
import { Avatar, Drawer, Panel, Stat, Status, SearchField, TierPill, useToast } from '../ui'
import { EMPTY_PLAN, Plan, PlanChips, PlanFields } from './MeetingPlan'
import { FromLastTime, SummarySection } from './MeetingSummary'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const MOM_ROWS = 5

export default function Meetings() {
  const { data: meetings = [] } = useMeetings()
  const { data: clients = [] } = useClients()
  const { data: prospects = [] } = useProspects()
  const { data: products = [] } = useProducts()
  const [params, setParams] = useSearchParams()
  const [anchor, setAnchor] = useState(() => parse(todayISO()))
  const [jump, setJump] = useState<{ day: string; n: number } | null>(null)
  const [allMom, setAllMom] = useState(false)
  const who = (m: any) => (m.with.kind === 'client' ? clients : prospects).find((x) => x.id === m.with.id)
  const P = Object.fromEntries(products.map((p) => [p.id, p]))
  const open = params.get('m') ? meetings.find((m) => m.id === params.get('m')) : null

  const now = nowISO()
  const upcoming = meetings.filter((m) => m.status === 'scheduled' && m.end >= now).sort((a, b) => a.start.localeCompare(b.start))
  const next = upcoming[0]
  const late = (m: any) => m.status === 'needs_mom' || (m.status === 'scheduled' && m.end < now)
  const needMom = meetings.filter(late)
  const promises = meetings.flatMap((m) => (m.promises || []).map((p: any) => ({ ...p, m }))).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '').localeCompare(b.due || ''))
  const thisWeek = meetings.filter((m) => { const n = (parse(m.start.slice(0, 10)).getTime() - parse(todayISO()).getTime()) / 864e5; return n >= -((new Date().getDay() + 6) % 7) && n < 7 - ((new Date().getDay() + 6) % 7) })
  const withMom = meetings.filter((m) => m.status === 'completed' && m.mom).length
  const pastAll = meetings.filter((m) => m.start < now && m.status !== 'cancelled').length

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Meetings</h1>
          <p className="lede">{meetings.filter((m) => m.start.slice(0, 10) === todayISO() && m.status === 'scheduled').length} today, {upcoming.filter((m) => m.start.slice(0, 10) === todayISO()).length} still to come; {thisWeek.length} this week. {needMom.length ? `${needMom.length} meetings still need a MoM.` : 'All MoMs written.'}</p>
        </div>
      </div>

      <section className="panel mb16">
        <div className="statline">
          <Stat label="This week" value={thisWeek.length} sub={`${thisWeek.filter((m) => m.with.kind === 'prospect').length} with prospects`} />
          <Stat label="MoMs written" value={`${Math.round((withMom / Math.max(1, pastAll)) * 100)}%`} sub={`${withMom} of ${pastAll} past meetings`} />
          <Stat label="Open promises" value={promises.filter((p) => !p.done).length} sub={`${promises.filter((p) => !p.done && p.due && p.due < todayISO()).length} overdue`} />
          <Stat label="Follow-up sent within a day" value="71%" sub="Firm average 64%" />
          <Stat label="Prospect meetings that convert" value="1 in 3" sub="Last 12 months" />
        </div>
      </section>

      <div className="grid g-main row-even mb16">
        {next ? <PrepPack m={next} who={who(next)} P={P} meetings={meetings} onOpen={() => setParams({ m: next.id })} /> : <Panel title="Next up"><p className="small muted">Nothing scheduled.</p></Panel>}
        <Panel title="Needs a MoM" aside="Summarise, then send the MoM">
          {needMom.length === 0 && <p className="small muted">All caught up.</p>}
          <div className="col" style={{ gap: 0 }}>
            {(allMom ? needMom : needMom.slice(0, MOM_ROWS)).map((m) => (
              <div key={m.id} className="w-line">
                <span className="grow small"><span className="strong">{m.title}</span><br /><span className="tiny muted">{who(m)?.name} · {when(m.start)}</span></span>
                <button className="btn btn-quiet btn-sm" onClick={() => setParams({ m: m.id })}><NotebookPen />{m.summary ? 'Send the MoM' : 'Summarise'}</button>
              </div>
            ))}
          </div>
          {needMom.length > MOM_ROWS && <button className="linkbtn small" style={{ marginTop: 10 }} aria-expanded={allMom} onClick={() => setAllMom((v) => !v)}>{allMom ? 'Show fewer' : `Show all ${needMom.length}`}</button>}
        </Panel>
      </div>

      <div className="grid g-main">
        <MeetingList meetings={meetings} who={who} P={P} onOpen={(id) => setParams({ m: id })} jump={jump} ready={!!(meetings.length && clients.length && prospects.length && products.length)} />
        <div className="col" style={{ gap: 16 }}>
          <MiniCal meetings={meetings} anchor={anchor} setAnchor={setAnchor} onDay={(d) => setJump({ day: d, n: Date.now() })} />
          <AgendaRollup P={P} />
          <Panel title="Promises" aside="Tracked until done">
            <div className="col" style={{ gap: 0 }}>
              {promises.length === 0 && <p className="small muted">No promises recorded yet.</p>}
              {promises.map((p, i) => (
                <div key={i} className="w-line small">
                  <span className={`kyc-dot ${p.done ? 'done' : ''}`} />
                  <span className="grow" style={{ textDecoration: p.done ? 'line-through' : 'none', color: p.done ? 'var(--muted)' : undefined }}>{p.text}<br /><span className="tiny muted">{who(p.m)?.name} · from {p.m.title}</span></span>
                  {p.due && <span className={`tiny ${!p.done && p.due < todayISO() ? 'u-overdue-l' : 'muted'}`}>{p.done ? 'Done' : `${p.due < todayISO() ? 'Overdue · ' : ''}${when(p.due)}`}</span>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {open && <MeetingDrawer m={open} who={who(open)} P={P} meetings={meetings} onClose={() => setParams({})} />}
    </main>
  )
}

function prep(m: any, who: any, P: Record<string, any>, meetings: any[]) {
  const past = meetings.filter((x) => x.with.id === m.with.id && x.mom && x.id !== m.id).sort((a, b) => b.start.localeCompare(a.start))[0]
  const open = meetings.filter((x) => x.with.id === m.with.id).flatMap((x) => (x.promises || []).filter((p: any) => !p.done))
  const talk = (who?.holdings || []).map((h: any) => P[h.product_id]).filter((p: any) => p && p.cio_view.stance !== 'Neutral').slice(0, 2)
  return { past, open, talk }
}

function PrepPack({ m, who, P, meetings, onOpen }: { m: any; who: any; P: Record<string, any>; meetings: any[]; onOpen: () => void }) {
  const { past, open, talk } = prep(m, who, P, meetings)
  const points = [
    ...(who?.red_flags || []).slice(0, 1).map((f: any) => <li key={f.text}>{f.text}</li>),
    ...talk.map((p: any) => <li key={p.id}>{p.name}: CIO {p.cio_view.stance.toLowerCase()}</li>),
    ...(who?.cash_flows || []).filter((f: any) => f.kind === 'Maturity').slice(0, 1).map((f: any, i: number) => <li key={`cf${i}`}>{inr(f.amount)} maturing {when(f.date)}</li>),
  ]
  return (
    <section className="panel next-up">
      <div className="panel-head"><h2>Next up</h2><button className="linkbtn small" onClick={onOpen}>Full prep pack <ChevronRight size={14} /></button></div>
      <div className="panel-body">
        <div className="row" style={{ gap: 14, marginBottom: 14 }}>
          <Avatar name={who?.name || ''} size={44} />
          <div className="grow"><div className="display" style={{ fontSize: 19, color: 'var(--ink-strong)' }}>{m.title}</div><div className="small muted">{who?.name} · {when(m.start)} · {m.location}</div></div>
          {who?.aum !== undefined ? <div className="stat" style={{ textAlign: 'right' }}><span className="label">With Kova</span><span className="display strong">{inr(who.aum)}</span></div> : <div className="stat" style={{ textAlign: 'right' }}><span className="label">Estimated</span><span className="display strong">{inr(who?.estimated_investable)}</span></div>}
        </div>
        <div className="grid g3" style={{ gap: 12 }}>
          <div className="prep-box"><div className="tiny muted">Agenda</div><ul>{m.agenda.map((a: string) => <li key={a}>{a}</li>)}{!m.agenda.length && <li className="muted">None set</li>}</ul><div style={{ marginTop: 6 }}><PlanChips plan={m.plan} P={P} /></div></div>
          <div className="prep-box"><div className="tiny muted">Last time</div><p className="small">{past?.mom?.summary || 'First recorded meeting.'}</p>{open.length > 0 && <p className="small row" style={{ marginTop: 6, gap: 6, alignItems: 'baseline' }}><span className="ring" aria-hidden /><span><span className="strong">Open promise:</span> {open[0].text}</span></p>}</div>
          <div className="prep-box"><div className="tiny muted">Talking points</div>{points.length ? <ul>{points}</ul> : <p className="small">Nothing flagged yet. <Link className="linkbtn" to={`/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}?panel=agent`}>Ask the agent to prepare you</Link>.</p>}</div>
        </div>
      </div>
    </section>
  )
}

function MeetingDrawer({ m, who, P, meetings, onClose }: { m: any; who: any; P: Record<string, any>; meetings: any[]; onClose: () => void }) {
  const { past, open, talk } = prep(m, who, P, meetings)
  const href = `/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}`
  return (
    <Drawer title={m.title} sub={`${when(m.start)}–${time(m.end)} · ${m.type}`} onClose={onClose}
      foot={<Link className="btn btn-quiet" to={href}>Open {m.with.kind}</Link>}>
      <div className="col" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 10 }}><Status s={m.status} />{m.created_by === 'agent' && <span className="pill brass"><span className="ring" style={{ width: 8, height: 8 }} />Set up by the agent</span>}</div>
        <Link to={href} className="row" style={{ gap: 10 }}><Avatar name={who?.name || ''} size={36} /><span><span className="strong">{who?.name}</span><br /><span className="tiny muted">{m.with.kind === 'client' ? `${who?.risk_profile} · ${inr(who?.aum)}` : `${who?.stage} · ${inr(who?.estimated_investable)}`}</span></span></Link>
        <div className="small row" style={{ gap: 6 }}><MapPin size={14} />{m.location}</div>
        <div><div className="tiny muted">Attending from Kova</div><div className="small row" style={{ gap: 6, marginTop: 4 }}><Users size={14} />Priya Sharma{m.attendees.map((a: any) => `, ${a.name} (${a.title})`).join('')}</div>
          <p className="tiny muted" style={{ marginTop: 4 }}>Colleagues listed here receive the MoM. Your manager sees it in their view without a notification.</p></div>
        <SummarySection m={m} P={P} />
        <PlanSection m={m} who={who} P={P} />
        <div><h3>Agenda</h3><ul className="small" style={{ paddingLeft: 18, margin: '6px 0 0' }}>{m.agenda.map((a: string) => <li key={a}>{a}</li>)}</ul>{!m.agenda.length && <p className="small muted">No agenda yet.</p>}</div>
        {m.mom ? (
          <div className="note-card">
            <h3>Minutes</h3>
            <p className="small" style={{ margin: '6px 0' }}>{m.mom.summary}</p>
            <dl className="kv small" style={{ gridTemplateColumns: '130px 1fr' }}>
              {m.mom.feedback && <><dt>Feedback</dt><dd>{m.mom.feedback}</dd></>}
              {m.mom.portfolio_reaction && <><dt>On the portfolio</dt><dd>{m.mom.portfolio_reaction}</dd></>}
              {m.mom.changes_asked?.length > 0 && <><dt>Changes asked</dt><dd>{m.mom.changes_asked.join('; ')}</dd></>}
              {m.mom.personal && <><dt>Personal</dt><dd>{m.mom.personal}</dd></>}
            </dl>
          </div>
        ) : (
          <div>
            <h3>Prep pack</h3>
            <div className="col small" style={{ gap: 8, marginTop: 8 }}>
              <FromLastTime m={m} meetings={meetings} P={P} />
              <div className="prep-box"><div className="tiny muted">Last time</div>{past?.mom?.summary || past?.summary?.portfolio?.discussed || 'First recorded meeting.'}</div>
              {open.length > 0 && <div className="prep-box"><div className="tiny muted">Open promises</div><ul>{open.map((p: any) => <li key={p.text}>{p.text}</li>)}</ul></div>}
              {talk.length > 0 && <div className="prep-box"><div className="tiny muted">Holdings to discuss</div><ul>{talk.map((p: any) => <li key={p.id}>{p.name}: {p.cio_view.comment.split('.')[0]}.</li>)}</ul></div>}
            </div>
          </div>
        )}
        {['scheduled', 'needs_mom'].includes(m.status) && !m.mom && <ChangeMeeting m={m} who={who} />}
        {m.changes?.length > 0 && (
          <div><h3>Changes</h3>
            <ol className="changes small">
              {[...m.changes].reverse().map((c: any, i: number) => (
                <li key={i}>
                  <span className="strong">{CHANGE_WORDS[c.what] || c.what}</span>{c.what === 'rescheduled' ? ` from ${when(c.from.start)} to ${when(c.to.start)}` : c.what === 'edited' ? `: ${Object.keys(c.to).join(', ')}` : ''}
                  {c.reason && <span className="muted">. {c.reason}</span>}
                  <div className="tiny muted">{when(c.at)} · {c.by}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {m.promises?.length > 0 && <div><h3>Promises</h3>{m.promises.map((p: any) => <div key={p.text} className="small w-line"><span className={`kyc-dot ${p.done ? 'done' : ''}`} /><span className="grow">{p.text}</span><span className="tiny muted">{p.due ? when(p.due) : ''}</span></div>)}</div>}
      </div>
    </Drawer>
  )
}

const CHANGE_WORDS: Record<string, string> = { rescheduled: 'Moved', edited: 'Details changed', cancelled: 'Cancelled', no_show: 'Marked as didn’t attend' }
const toLocal = (s: string) => s.slice(0, 16)

/* Reschedule, edit, cancel or mark a no-show. Each runs the same server action an agent card would. */
function ChangeMeeting({ m, who }: { m: any; who: any }) {
  const [mode, setMode] = useState<null | 'move' | 'edit' | 'cancel' | 'noshow'>(null)
  const mins = Math.round((parse(m.end).getTime() - parse(m.start).getTime()) / 60000) || 45
  const [f, setF] = useState({ start: toLocal(m.start), duration_minutes: mins, location: m.location, agenda: (m.agenda || []).join('\n'), reason: '', notify_client: true })
  const { busy, run } = useAction()
  const toast = useToast()
  const first = (who?.first_name || who?.name || 'the client').split(' ')[0]
  const started = m.start <= nowISO()
  const go = (action: string, body: any, done: string) => run(async () => {
    await api(`/actions/${action}`, { body: { meeting_id: m.id, ...body } })
    invalidate('/c/'); setMode(null); toast(done)
  }, 'The meeting wasn’t changed')
  if (!mode) return (
    <div className="row wrap" style={{ gap: 8 }}>
      <button className="btn btn-quiet btn-sm" onClick={() => setMode('move')}><CalendarClock aria-hidden />Reschedule</button>
      <button className="btn btn-quiet btn-sm" onClick={() => setMode('edit')}><Pencil aria-hidden />Edit details</button>
      {started && <button className="btn btn-quiet btn-sm" onClick={() => setMode('noshow')}><UserX aria-hidden />They didn’t attend</button>}
      <button className="btn btn-ghost btn-sm danger" onClick={() => setMode('cancel')}><XCircle aria-hidden />Cancel meeting</button>
    </div>
  )
  const notify = (
    <label className="check small"><input type="checkbox" checked={f.notify_client} onChange={(e) => setF({ ...f, notify_client: e.target.checked })} />
      {mode === 'cancel' ? `Tell ${first} it’s cancelled` : `Send ${first} the updated invite`}</label>
  )
  return (
    <div className="change-box">
      {mode === 'move' && <>
        <h3>Reschedule</h3>
        <div className="grid g2" style={{ gap: 10 }}>
          <label className="field"><span>New time</span><input className="input" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /><span className="tiny muted">{when(f.start)}</span></label>
          <label className="field"><span>Length</span><select className="select" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: +e.target.value })}>{[20, 30, 45, 60, 90].map((x) => <option key={x} value={x}>{x} minutes</option>)}</select></label>
        </div>
        <label className="field"><span>Where</span><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
        <label className="field"><span>Why it’s moving (only you see this)</span><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        {notify}
        <div className="row"><button className="btn btn-primary" disabled={busy || f.start === toLocal(m.start) && f.duration_minutes === mins && f.location === m.location}
          onClick={() => go('reschedule_meeting', { start: f.start, duration_minutes: f.duration_minutes, location: f.location, reason: f.reason, notify_client: f.notify_client }, f.notify_client ? `Moved to ${when(f.start)}. The updated invite is in the outbox.` : `Moved to ${when(f.start)}`)}>Move meeting</button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>Keep as is</button></div>
      </>}
      {mode === 'edit' && <>
        <h3>Edit details</h3>
        <label className="field"><span>Where</span><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
        <label className="field"><span>Agenda, one point per line</span><textarea className="textarea" rows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></label>
        {f.location !== m.location && notify}
        <div className="row"><button className="btn btn-primary" disabled={busy}
          onClick={() => go('edit_meeting', { location: f.location, agenda: f.agenda.split('\n').map((x: string) => x.trim()).filter(Boolean), notify_client: f.notify_client }, 'Meeting details saved')}>Save details</button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>Keep as is</button></div>
      </>}
      {mode === 'cancel' && <>
        <h3>Cancel meeting</h3>
        <label className="field"><span>Why (only you see this)</span><input className="input" autoFocus value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        {notify}
        <div className="row"><button className="btn btn-danger" disabled={busy || !f.reason.trim()} onClick={() => go('cancel_meeting', { reason: f.reason, notify_client: f.notify_client }, 'Meeting cancelled')}>Cancel meeting</button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>Keep it</button></div>
      </>}
      {mode === 'noshow' && <>
        <h3>They didn’t attend</h3>
        <label className="field"><span>Note (optional)</span><input className="input" value={f.reason} placeholder="Phone off, will call tomorrow" onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <p className="tiny muted">Nothing is sent to {first}. A follow-up appears in your Updates.</p>
        <div className="row"><button className="btn btn-primary" disabled={busy} onClick={() => go('mark_no_show', { note: f.reason }, 'Marked as didn’t attend. Follow-up added to Updates.')}>Mark as didn’t attend</button>
          <button className="btn btn-ghost" onClick={() => setMode(null)}>Keep as is</button></div>
      </>}
    </div>
  )
}

/* ---------- the meetings list: future above, past below, opens at today */
const STATUS_FILTERS = [{ k: '', l: 'Any status' }, { k: 'scheduled', l: 'Scheduled' }, { k: 'needs_mom', l: 'Needs a MoM' }, { k: 'completed', l: 'Completed' }, { k: 'cancelled', l: 'Cancelled' }, { k: 'no_show', l: 'Didn’t attend' }]
const TYPES = ['Review', 'Proposal', 'First meeting', 'Service', 'Family meeting']
const dayLabel = (d: string) => {
  const n = Math.round((parse(d).getTime() - parse(todayISO()).getTime()) / 864e5)
  const full = parse(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return n === 0 ? `Today · ${full}` : n === 1 ? `Tomorrow · ${full}` : n === -1 ? `Yesterday · ${full}` : full
}

function MeetingList({ meetings, who, P, onOpen, jump, ready }: { meetings: any[]; who: (m: any) => any; P: Record<string, any>; onOpen: (id: string) => void; jump: { day: string; n: number } | null; ready: boolean }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [tier, setTier] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const today = todayISO()
  const hay = (m: any) => {
    const w = who(m)
    const plan = m.plan || {}
    return [m.title, m.type, m.location, w?.name, w?.id, ...(m.agenda || []), plan.portfolio, ...(plan.service || []), plan.notes,
      ...(plan.products || []).flatMap((id: string) => [P[id]?.name, P[id]?.subcategory, P[id]?.product_type])].filter(Boolean).join(' ').toLowerCase()
  }
  const list = meetings
    .filter((m) => (!status || (status === 'needs_mom' ? (m.status === 'needs_mom' || (m.status === 'scheduled' && m.end < nowISO())) : m.status === status))
      && (!type || m.type === type) && (!tier || who(m)?.tier === tier) && (!q || q.toLowerCase().split(/\s+/).every((w) => hay(m).includes(w))))
    .sort((a, b) => b.start.localeCompare(a.start))
  const days: { day: string; items: any[] }[] = []
  for (const m of list) {
    const d = m.start.slice(0, 10)
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, items: [] })
    days[days.length - 1].items.push(m)
  }
  if (!days.some((d) => d.day === today)) {  // keep a "today" line so the list always opens at now
    const at = days.findIndex((d) => d.day < today)
    days.splice(at < 0 ? days.length : at, 0, { day: today, items: [] })
  }
  const scrollTo = (day: string) => {
    const el = box.current
    if (!el) return
    const target = [...el.querySelectorAll<HTMLElement>('[data-day]')].find((x) => (x.dataset.day || '') <= day) || el.querySelector<HTMLElement>('[data-day]:last-child')
    if (target) el.scrollTop = target.offsetTop // .mlist is the offset parent (position: relative)
  }
  useLayoutEffect(() => { scrollTo(today) }, [q, status, type, tier, meetings.length, ready]) // names and plans change row heights, so again once all has loaded
  useEffect(() => { if (jump) scrollTo(jump.day) }, [jump])
  const ahead = list.filter((m) => m.start.slice(0, 10) >= today).length
  return (
    <section className="panel meeting-list-panel">
      <div className="panel-head"><h2>All meetings</h2><span className="tiny muted">{ahead} ahead · {list.length - ahead} before today · scroll up for later, down for earlier</span></div>
      <div className="list-toolbar">
        <SearchField value={q} onChange={setQ} placeholder="Client, product, portfolio, topic…" label="Search meetings" width={260} />
        <select className="select sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>{STATUS_FILTERS.map((f) => <option key={f.k} value={f.k}>{f.l}</option>)}</select>
        <select className="select sm" aria-label="Meeting type" value={type} onChange={(e) => setType(e.target.value)} style={{ width: 150 }}><option value="">Any type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="select sm" aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: 120 }}><option value="">Any tier</option>{[...TIERS].reverse().map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
      </div>
      <div className="mlist" ref={box} aria-label="Meetings by day, latest first">
        {days.map(({ day, items }) => (
          <div key={day} data-day={day} className={`mday ${day === today ? 'today' : day > today ? 'ahead' : 'past'}`}>
            <div className="mday-head">{dayLabel(day)}{day === today && !items.length && <span className="tiny muted"> · nothing scheduled</span>}</div>
            {items.slice().sort((a, b) => a.start.localeCompare(b.start)).map((m) => {
              const w = who(m)
              const late = m.status === 'needs_mom' || (m.status === 'scheduled' && m.end < nowISO())
              return (
                <button key={m.id} className={`mrow ${m.status}`} onClick={() => onOpen(m.id)} aria-label={`${time(m.start)}, ${w?.name}: ${m.title}`}>
                  <span className="mrow-time num">{time(m.start)}</span>
                  <span className="mrow-main">
                    <span className="row" style={{ gap: 6 }}>
                      {m.created_by === 'agent' && <span className="ring" style={{ width: 8, height: 8 }} title="Set up by the agent" />}
                      <span className="strong">{w?.name}</span>
                      {m.with.kind === 'client' ? <TierPill t={w?.tier} /> : <span className="pill outline">Prospect</span>}
                    </span>
                    <span className="small">{m.title} <span className="muted">· {m.type}</span></span>
                    <PlanChips plan={m.plan} P={P} />
                  </span>
                  <span className="mrow-status">{late ? <Status s="needs_mom" /> : m.status !== 'scheduled' ? <Status s={m.status} /> : null}</span>
                </button>
              )
            })}
          </div>
        ))}
        {list.length === 0 && <div className="empty small">No meetings match. Clear the search or filters.</div>}
      </div>
    </section>
  )
}

/* ---------- the calendar, now a small month widget; a day jumps the list there */
function MiniCal({ meetings, anchor, setAnchor, onDay }: { meetings: any[]; anchor: Date; setAnchor: (d: Date) => void; onDay: (d: string) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const count = (d: Date) => meetings.filter((m) => m.start.slice(0, 10) === iso(d) && m.status !== 'cancelled').length
  const move = (n: number) => { const d = new Date(anchor); d.setMonth(d.getMonth() + n); setAnchor(d) }
  return (
    <Panel title={anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} aside={<span className="row" style={{ gap: 2 }}><button className="iconbtn sm" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={14} /></button><button className="iconbtn sm" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={14} /></button></span>}>
      <div className="minical">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="tiny muted mc-dow" aria-hidden>{d}</span>)}
        {cells.map((d) => {
          const n = count(d)
          return (
            <button key={iso(d)} className={`mc-day ${d.getMonth() !== anchor.getMonth() ? 'out' : ''} ${iso(d) === todayISO() ? 'today' : ''} ${n ? 'has' : ''}`}
              onClick={() => onDay(iso(d))} aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}: ${n} meeting${n === 1 ? '' : 's'}. Show in the list`}>
              <span>{d.getDate()}</span>{n > 0 && <i aria-hidden>{n > 1 ? n : ''}</i>}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

/* ---------- what's planned in the next 30 days: the same roll-up the CIO and product teams see */
function AgendaRollup({ P }: { P: Record<string, any> }) {
  const { data: s } = useApi<any>('/meetings/plan-summary?days=30')
  if (!s) return null
  return (
    <Panel title="On your agenda" aside="Next 30 days">
      {!s.products.length && !Object.keys(s.portfolio).length && !Object.keys(s.service).length ? <p className="small muted">Nothing planned yet. Add a plan when you schedule a meeting.</p> : (
        <div className="col" style={{ gap: 10 }}>
          {s.products.length > 0 && <div><div className="tiny muted" style={{ marginBottom: 4 }}>Products to discuss</div>
            {s.products.slice(0, 5).map((r: any) => <Link key={r.product_id} to={`/products/${r.product_id}`} className="w-line small"><span className="grow ellipsis">{P[r.product_id]?.name || r.name}<br /><span className="tiny muted">{r.with.slice(0, 2).join(', ')}{r.with.length > 2 ? ` and ${r.with.length - 2} more` : ''}</span></span><span className="num strong">{r.meetings}</span></Link>)}</div>}
          {Object.keys(s.portfolio).length > 0 && <div className="small"><span className="tiny muted">Portfolio </span>{Object.entries(s.portfolio).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>}
          {Object.keys(s.service).length > 0 && <div className="small"><span className="tiny muted">Service </span>{Object.entries(s.service).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>}
          <p className="tiny muted">The CIO and product teams see the same roll-up across RMs, so they can prepare notes before you meet.</p>
        </div>
      )}
    </Panel>
  )
}

/* ---------- the plan inside the meeting drawer, editable while the meeting can still change */
function PlanSection({ m, who, P }: { m: any; who: any; P: Record<string, any> }) {
  const [edit, setEdit] = useState(false)
  const [plan, setPlan] = useState<Plan>(m.plan || EMPTY_PLAN)
  const { busy, run } = useAction()
  const toast = useToast()
  const changeable = ['scheduled', 'needs_mom'].includes(m.status) && !m.mom
  const suggest: string[] = m.with.kind === 'client' ? (who?.holdings || []).map((h: any) => h.product_id) : (who?.interests || [])
  const save = () => run(async () => {
    await api('/actions/edit_meeting', { body: { meeting_id: m.id, plan } })
    invalidate('/c/meetings'); invalidate('/meetings/')
    setEdit(false)
    toast('Plan saved. It stays internal; the client isn’t sent anything.')
  }, 'The plan wasn’t saved')
  const has = m.plan && (m.plan.products.length || m.plan.portfolio || m.plan.service.length || m.plan.notes)
  return (
    <div>
      <div className="spread"><h3>Plan</h3>{changeable && !edit && <button className="linkbtn small" onClick={() => { setPlan(m.plan || EMPTY_PLAN); setEdit(true) }}><Pencil size={13} />Edit plan</button>}</div>
      {edit ? (
        <div className="col" style={{ gap: 8, marginTop: 6 }}>
          <PlanFields v={plan} onChange={setPlan} suggest={suggest} />
          <div className="row"><button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save plan</button><button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Cancel</button></div>
        </div>
      ) : has ? (
        <dl className="kv small" style={{ gridTemplateColumns: '110px 1fr', marginTop: 6 }}>
          {m.plan.portfolio && <><dt>Portfolio</dt><dd>{m.plan.portfolio}</dd></>}
          {m.plan.products.length > 0 && <><dt>Products</dt><dd>{m.plan.products.map((id: string) => <Link key={id} to={`/products/${id}`} className="linkbtn" style={{ marginRight: 8 }}>{P[id]?.name || id}</Link>)}</dd></>}
          {m.plan.service.length > 0 && <><dt>Service</dt><dd>{m.plan.service.join(', ')}</dd></>}
          {m.plan.notes && <><dt>Note to self</dt><dd>{m.plan.notes}</dd></>}
        </dl>
      ) : <p className="small muted" style={{ marginTop: 4 }}>No plan yet.</p>}
    </div>
  )
}
