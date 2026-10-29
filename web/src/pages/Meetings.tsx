import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, NotebookPen, Pencil, UserX, Users, XCircle } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { useAction } from '../lib/action'
import { useClients, useMeetings, useProducts, useProspects } from '../lib/data'
import { date, inr, nowISO, parse, time, todayISO, when, stripTitle } from '../lib/format'
import { Avatar, Drawer, Panel, Stat, Status, SearchField, useToast } from '../ui'

// Lay out overlapping events side by side: each event gets a lane and the lane count of its cluster (MT1)
function lanes(evs: any[]) {
  const out = new Map<string, { lane: number; of: number }>()
  let cluster: any[] = [], ends: string[] = [], clusterEnd = ''
  const flush = () => { cluster.forEach((m) => { out.get(m.id)!.of = ends.length }); cluster = []; ends = [] }
  for (const m of evs) {
    if (cluster.length && m.start >= clusterEnd) flush()
    let lane = ends.findIndex((e) => e <= m.start)
    if (lane < 0) { lane = ends.length; ends.push(m.end) } else ends[lane] = m.end
    out.set(m.id, { lane, of: 1 }); cluster.push(m)
    clusterEnd = cluster.length === 1 ? m.end : (m.end > clusterEnd ? m.end : clusterEnd)
  }
  flush()
  return out
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const MOM_ROWS = 5
const HOURS = Array.from({ length: 11 }, (_, i) => 9 + i)

export default function Meetings() {
  const { data: meetings = [] } = useMeetings()
  const { data: clients = [] } = useClients()
  const { data: prospects = [] } = useProspects()
  const { data: products = [] } = useProducts()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => parse(todayISO()))
  const [q, setQ] = useState('')
  const [allMom, setAllMom] = useState(false)
  const nav = useNavigate()
  const who = (m: any) => (m.with.kind === 'client' ? clients : prospects).find((x) => x.id === m.with.id)
  const P = Object.fromEntries(products.map((p) => [p.id, p]))
  const open = params.get('m') ? meetings.find((m) => m.id === params.get('m')) : null

  const now = nowISO()
  const upcoming = meetings.filter((m) => m.status === 'scheduled' && m.end >= now).sort((a, b) => a.start.localeCompare(b.start))
  const next = upcoming[0]
  const late = (m: any) => m.status === 'needs_mom' || (m.status === 'scheduled' && m.end < now)
  const needMom = meetings.filter(late)
  const promises = meetings.flatMap((m) => (m.promises || []).map((p: any) => ({ ...p, m }))).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '').localeCompare(b.due || ''))
  const history = meetings.filter((m) => ['completed', 'cancelled', 'no_show'].includes(m.status)).filter((m) => !q || (m.title + (who(m)?.name || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.start.localeCompare(a.start))

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === 'week') { const mon = new Date(anchor); mon.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7)); return Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d }) }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [view, anchor])
  const shift = (n: number) => { const d = new Date(anchor); if (view === 'month') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1)); setAnchor(d) }
  const inDay = (d: Date) => meetings.filter((m) => m.start.slice(0, 10) === iso(d) && m.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start))
  const thisWeek = meetings.filter((m) => { const n = (parse(m.start.slice(0, 10)).getTime() - parse(todayISO()).getTime()) / 864e5; return n >= -((new Date().getDay() + 6) % 7) && n < 7 - ((new Date().getDay() + 6) % 7) })
  const withMom = meetings.filter((m) => m.status === 'completed' && m.mom).length
  const pastAll = meetings.filter((m) => m.start < now && m.status !== 'cancelled').length
  const title = view === 'month' ? anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : view === 'day' ? anchor.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : `${date(iso(days[0]))} – ${date(iso(days[5]))}`

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
        <Panel title="Needs a MoM" aside="One tap opens the agent">
          {needMom.length === 0 && <p className="small muted">All caught up.</p>}
          <div className="col" style={{ gap: 0 }}>
            {(allMom ? needMom : needMom.slice(0, MOM_ROWS)).map((m) => (
              <div key={m.id} className="w-line">
                <span className="grow small"><span className="strong">{m.title}</span><br /><span className="tiny muted">{who(m)?.name} · {when(m.start)}</span></span>
                <button className="btn btn-quiet btn-sm" onClick={() => nav(`/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}?panel=agent&mom=${m.id}`)}><NotebookPen />Write MoM</button>
              </div>
            ))}
          </div>
          {needMom.length > MOM_ROWS && <button className="linkbtn small" style={{ marginTop: 10 }} aria-expanded={allMom} onClick={() => setAllMom((v) => !v)}>{allMom ? 'Show fewer' : `Show all ${needMom.length}`}</button>}
        </Panel>
      </div>

      <section className="panel mb16">
        <div className="cal-toolbar">
          <div className="row"><button className="iconbtn" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft /></button><button className="btn btn-quiet btn-sm" onClick={() => setAnchor(parse(todayISO()))}>Today</button><button className="iconbtn" onClick={() => shift(1)} aria-label="Next"><ChevronRight /></button><h2 style={{ marginLeft: 8 }}>{title}</h2></div>
          <div className="row" style={{ gap: 14 }}>
            <div className="row wrap tiny muted" style={{ gap: 10 }}><span className="row" style={{ gap: 5 }}><i className="cal-key needs" />Needs a MoM</span><span className="row" style={{ gap: 5 }}><span className="ring" />Set up by the agent</span></div>
            <div className="seg" role="group" aria-label="Calendar view">{(['day', 'week', 'month'] as const).map((v) => <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
          </div>
        </div>
        {view === 'month' ? (
          <div className="month">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="month-dow tiny muted">{d}</div>)}
            {days.map((d) => (
              <button key={iso(d)} className={`month-cell ${d.getMonth() !== anchor.getMonth() ? 'out' : ''} ${iso(d) === todayISO() ? 'today' : ''}`} onClick={() => { setAnchor(d); setView('day') }} aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${inDay(d).length} meeting${inDay(d).length === 1 ? '' : 's'}. Open the day`}>
                <span className="tiny" aria-hidden>{d.getDate()}</span>
                {inDay(d).slice(0, 3).map((m) => <span key={m.id} className={`month-ev ${m.status} ${late(m) ? 'needs_mom' : ''}`}>{time(m.start)} {stripTitle(who(m)?.name || '').split(' ')[0]}</span>)}
                {inDay(d).length > 3 && <span className="tiny muted">+{inDay(d).length - 3} more</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="cal" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => <div key={iso(d)} className={`cal-day-head ${iso(d) === todayISO() ? 'today' : ''}`}><span className="tiny muted">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span><span className="display">{d.getDate()}</span></div>)}
            <div className="cal-hours">{HOURS.map((h) => <div key={h} className="tiny faint">{h > 12 ? h - 12 : h} {h >= 12 ? 'pm' : 'am'}</div>)}</div>
            {days.map((d) => (
              <div key={iso(d)} className="cal-col">
                {HOURS.map((h) => <div key={h} className="cal-slot" />)}
                {iso(d) === todayISO() && new Date().getHours() >= 9 && new Date().getHours() < 20 && <div className="cal-now" style={{ top: `${((new Date().getHours() + new Date().getMinutes() / 60 - 9) / 11) * 100}%` }} />}
                {(() => { const L = lanes(inDay(d)); return inDay(d).map((m) => {
                  const s = parse(m.start), e = parse(m.end)
                  const top = ((s.getHours() + s.getMinutes() / 60 - 9) / 11) * 100
                  const mins = (e.getTime() - s.getTime()) / 6e4
                  const h = Math.max((mins / 60 / 11) * 100, 4.5)
                  const { lane, of } = L.get(m.id)!
                  const label = `${time(m.start)}, ${who(m)?.name}: ${m.title} (${m.type})`
                  return (
                    <button key={m.id} className={`cal-ev ${m.status} ${late(m) ? 'needs_mom' : ''} ${mins < 45 ? 'short' : ''}`} title={label} aria-label={label}
                      style={{ top: `${top}%`, height: `${h}%`, left: `calc(${(lane / of) * 100}% + 4px)`, width: `calc(${100 / of}% - 8px)`, right: 'auto' }} onClick={() => setParams({ m: m.id })}>
                      {mins < 45 ? (
                        <span className="tiny ellipsis">{m.created_by === 'agent' && <span className="ring" style={{ width: 8, height: 8, marginRight: 4 }} />}<span className="strong">{time(m.start)}</span> {who(m)?.name}</span>
                      ) : (<>
                        <span className="tiny strong ellipsis">{m.created_by === 'agent' && <span className="ring" style={{ width: 8, height: 8, marginRight: 4 }} />}{who(m)?.name}</span>
                        <span className="tiny muted ellipsis">{time(m.start)} · {m.type}</span>
                      </>)}
                    </button>
                  )
                }) })()}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid g2">
        <Panel title="Promises" aside="Commitments made in meetings, tracked until done">
          <div className="col" style={{ gap: 0 }}>
            {promises.map((p, i) => (
              <div key={i} className="w-line small">
                <span className={`kyc-dot ${p.done ? 'done' : ''}`} />
                <span className="grow" style={{ textDecoration: p.done ? 'line-through' : 'none', color: p.done ? 'var(--muted)' : undefined }}>{p.text}<br /><span className="tiny muted">{who(p.m)?.name} · from {p.m.title}</span></span>
                {p.due && <span className={`tiny ${!p.done && p.due < todayISO() ? 'u-overdue-l' : 'muted'}`}>{p.done ? 'Done' : `${p.due < todayISO() ? 'Overdue · ' : ''}${when(p.due)}`}</span>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="History" aside={<SearchField value={q} onChange={setQ} placeholder="Name or title…" label="Search meeting history" height={30} width={200} style={{ width: 200 }} />}>
          <div className="col" style={{ gap: 0 }}>
            {history.map((m) => (
              <button key={m.id} className="w-line small" style={{ textAlign: 'left' }} onClick={() => setParams({ m: m.id })}>
                <span className="grow"><span className="strong">{m.title}</span><br /><span className="tiny muted">{who(m)?.name} · {date(m.start)}{m.mom ? ` · ${m.mom.summary.slice(0, 70)}…` : ''}</span></span>
                <Status s={m.status} />
              </button>
            ))}
          </div>
        </Panel>
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
          <div className="prep-box"><div className="tiny muted">Agenda</div><ul>{m.agenda.map((a: string) => <li key={a}>{a}</li>)}{!m.agenda.length && <li className="muted">None set</li>}</ul></div>
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
      foot={<><Link className="btn btn-quiet" to={href}>Open {m.with.kind}</Link>{!m.mom && <Link className="btn btn-primary" to={`${href}?panel=agent&mom=${m.id}`}><NotebookPen />Record MoM with the agent</Link>}</>}>
      <div className="col" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 10 }}><Status s={m.status} />{m.created_by === 'agent' && <span className="pill brass"><span className="ring" style={{ width: 8, height: 8 }} />Set up by the agent</span>}</div>
        <Link to={href} className="row" style={{ gap: 10 }}><Avatar name={who?.name || ''} size={36} /><span><span className="strong">{who?.name}</span><br /><span className="tiny muted">{m.with.kind === 'client' ? `${who?.risk_profile} · ${inr(who?.aum)}` : `${who?.stage} · ${inr(who?.estimated_investable)}`}</span></span></Link>
        <div className="small row" style={{ gap: 6 }}><MapPin size={14} />{m.location}</div>
        <div><div className="tiny muted">Attending from Kova</div><div className="small row" style={{ gap: 6, marginTop: 4 }}><Users size={14} />Priya Sharma{m.attendees.map((a: any) => `, ${a.name} (${a.title})`).join('')}</div>
          <p className="tiny muted" style={{ marginTop: 4 }}>Colleagues listed here receive the MoM. Your manager sees it in their view without a notification.</p></div>
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
              <div className="prep-box"><div className="tiny muted">Last time</div>{past?.mom?.summary || 'First recorded meeting.'}</div>
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
