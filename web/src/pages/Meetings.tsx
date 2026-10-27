import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, NotebookPen, Users } from 'lucide-react'
import { useClients, useMeetings, useProducts, useProspects } from '../lib/data'
import { date, inr, nowISO, parse, time, todayISO, when } from '../lib/format'
import { Avatar, Drawer, Panel, Stat, Status, SearchField } from '../ui'

const TYPE_COLOR: Record<string, string> = { Review: '#1D3A2E', Proposal: '#9A7A47', 'First meeting': '#5F7D6E', Service: '#77736A', 'Family meeting': '#2C4E63' }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const nav = useNavigate()
  const who = (m: any) => (m.with.kind === 'client' ? clients : prospects).find((x) => x.id === m.with.id)
  const P = Object.fromEntries(products.map((p) => [p.id, p]))
  const open = params.get('m') ? meetings.find((m) => m.id === params.get('m')) : null

  const now = nowISO()
  const upcoming = meetings.filter((m) => m.status === 'scheduled' && m.end >= now).sort((a, b) => a.start.localeCompare(b.start))
  const next = upcoming[0]
  const needMom = meetings.filter((m) => m.status === 'needs_mom' || (m.status === 'scheduled' && m.end < now))
  const promises = meetings.flatMap((m) => (m.promises || []).map((p: any) => ({ ...p, m }))).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '').localeCompare(b.due || ''))
  const history = meetings.filter((m) => m.status === 'completed' || m.status === 'cancelled').filter((m) => !q || (m.title + (who(m)?.name || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.start.localeCompare(a.start))

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
          <p className="lede">{upcoming.filter((m) => m.start.slice(0, 10) === todayISO()).length} today, {thisWeek.length} this week. {needMom.length ? `${needMom.length} meetings still need a MoM.` : 'All MoMs written.'}</p>
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

      <div className="grid g-main mb16">
        {next ? <PrepPack m={next} who={who(next)} P={P} meetings={meetings} onOpen={() => setParams({ m: next.id })} /> : <Panel title="Next up"><p className="small muted">Nothing scheduled.</p></Panel>}
        <Panel title="Needs a MoM" aside="One tap opens the agent">
          {needMom.length === 0 && <p className="small muted">All caught up.</p>}
          <div className="col" style={{ gap: 0 }}>
            {needMom.map((m) => (
              <div key={m.id} className="w-line">
                <span className="grow small"><span className="strong">{m.title}</span><br /><span className="tiny muted">{who(m)?.name} · {when(m.start)}</span></span>
                <button className="btn btn-quiet btn-sm" onClick={() => nav(`/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}?panel=agent&mom=${m.id}`)}><NotebookPen />Write MoM</button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <section className="panel mb16">
        <div className="cal-toolbar">
          <div className="row"><button className="iconbtn" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft /></button><button className="btn btn-quiet btn-sm" onClick={() => setAnchor(parse(todayISO()))}>Today</button><button className="iconbtn" onClick={() => shift(1)} aria-label="Next"><ChevronRight /></button><h2 style={{ marginLeft: 8 }}>{title}</h2></div>
          <div className="row" style={{ gap: 14 }}>
            <div className="row wrap tiny muted" style={{ gap: 10 }}>{Object.entries(TYPE_COLOR).map(([k, c]) => <span key={k} className="row" style={{ gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{k}</span>)}<span className="row" style={{ gap: 5 }}><span className="ring" />Set up by the agent</span></div>
            <div className="seg" role="group" aria-label="Calendar view">{(['day', 'week', 'month'] as const).map((v) => <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
          </div>
        </div>
        {view === 'month' ? (
          <div className="month">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="month-dow tiny muted">{d}</div>)}
            {days.map((d) => (
              <button key={iso(d)} className={`month-cell ${d.getMonth() !== anchor.getMonth() ? 'out' : ''} ${iso(d) === todayISO() ? 'today' : ''}`} onClick={() => { setAnchor(d); setView('day') }} aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${inDay(d).length} meeting${inDay(d).length === 1 ? '' : 's'}. Open the day`}>
                <span className="tiny" aria-hidden>{d.getDate()}</span>
                {inDay(d).slice(0, 3).map((m) => <span key={m.id} className="month-ev" style={{ borderColor: TYPE_COLOR[m.type] }}>{time(m.start)} {who(m)?.name?.split(' ')[0]}</span>)}
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
                {inDay(d).map((m) => {
                  const s = parse(m.start), e = parse(m.end)
                  const top = ((s.getHours() + s.getMinutes() / 60 - 9) / 11) * 100
                  const h = Math.max(((e.getTime() - s.getTime()) / 36e5 / 11) * 100, 4.5)
                  return (
                    <button key={m.id} className={`cal-ev ${m.status}`} style={{ top: `${top}%`, height: `${h}%`, borderLeftColor: TYPE_COLOR[m.type] }} onClick={() => setParams({ m: m.id })}>
                      <span className="tiny strong ellipsis">{m.created_by === 'agent' && <span className="ring" style={{ width: 8, height: 8, marginRight: 4 }} />}{who(m)?.name}</span>
                      <span className="tiny muted ellipsis">{time(m.start)} · {m.title}</span>
                    </button>
                  )
                })}
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
          <div className="prep-box"><div className="tiny muted">Last time</div><p className="small">{past?.mom?.summary || 'First recorded meeting.'}</p>{open.length > 0 && <p className="small" style={{ marginTop: 6, color: 'var(--loss-ink)' }}>Open promise: {open[0].text}</p>}</div>
          <div className="prep-box"><div className="tiny muted">Talking points</div><ul>{(who?.red_flags || []).slice(0, 1).map((f: any) => <li key={f.text}>{f.text}</li>)}{talk.map((p: any) => <li key={p.id}>{p.name}: CIO {p.cio_view.stance.toLowerCase()}</li>)}{(who?.cash_flows || []).filter((f: any) => f.kind === 'Maturity').slice(0, 1).map((f: any, i: number) => <li key={i}>{inr(f.amount)} maturing {when(f.date)}</li>)}</ul></div>
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
        {m.promises?.length > 0 && <div><h3>Promises</h3>{m.promises.map((p: any) => <div key={p.text} className="small w-line"><span className={`kyc-dot ${p.done ? 'done' : ''}`} /><span className="grow">{p.text}</span><span className="tiny muted">{p.due ? when(p.due) : ''}</span></div>)}</div>}
      </div>
    </Drawer>
  )
}
