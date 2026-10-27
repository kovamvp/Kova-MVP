import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlarmClockCheck, ArrowUpRight, Bell, Check, ChevronDown, ChevronRight, CircleAlert, Code, FileText, Headset, LayoutGrid, MessageSquare, Mic, NotebookPen, Plus, Receipt, Send, Ticket, TriangleAlert } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { deferred, useAction } from '../lib/action'
import { useClients, useRequests } from '../lib/data'
import { daysFrom, inr, label, when } from '../lib/format'
import { Drawer, EntityLink, LoadError, Modal, SkeletonRows, Stat, Status, useToast } from '../ui'

const TYPE: Record<string, { icon: any; label: string }> = {
  reimbursement: { icon: Receipt, label: 'Reimbursement' }, product_feedback: { icon: Send, label: 'Product feedback' },
  service_request: { icon: Headset, label: 'Service request' }, mom_ack: { icon: NotebookPen, label: 'MoM acknowledgement' },
  portfolio_approval: { icon: LayoutGrid, label: 'Portfolio approval' }, ticket: { icon: Ticket, label: 'Ticket' },
}
const TABS = [
  { key: 'me', label: 'Waiting on me', f: (r: any) => r.direction === 'waiting_on_me' },
  { key: 'others', label: 'With other teams', f: (r: any) => r.direction === 'waiting_on_others' && r.type !== 'ticket' && r.type !== 'portfolio_approval' },
  { key: 'approvals', label: 'Portfolio approvals', f: (r: any) => r.type === 'portfolio_approval' && r.direction !== 'completed' },
  { key: 'tickets', label: 'Tickets', f: (r: any) => r.type === 'ticket' && r.direction !== 'completed' },
  { key: 'done', label: 'Completed', f: (r: any) => r.direction === 'completed' },
  { key: 'outbox', label: 'Outbox', f: () => false },
]
const TEAMS = ['Operations', 'Client Experience', 'Accounts', 'Product: Mutual Funds', 'Product: PMS & AIF', 'Product: Fixed Income', 'Compliance', 'Technology']

export default function Requests() {
  const { data: requestsRaw = [], loading, error, reload } = useRequests(15000)
  const [resolving, setResolving] = useState<Set<string>>(new Set())
  const requests = useMemo(() => requestsRaw.map((r) => (resolving.has(r.id) ? { ...r, status: 'done', direction: 'completed' } : r)), [requestsRaw, resolving])
  const { data: outbox = [] } = useApi<any[]>('/c/outbox', { poll: 20000 })
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || (params.get('o') ? 'outbox' : 'me')
  const openId = params.get('r')
  const [ticket, setTicket] = useState(params.get('ticket') === '1')
  const toast = useToast()
  const open = openId ? requests.find((r) => r.id === openId) : null
  const counts = Object.fromEntries(TABS.map((t) => [t.key, t.key === 'outbox' ? outbox.length : requests.filter(t.f).length]))
  const list = requests.filter(TABS.find((t) => t.key === tab)!.f).sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0) || (a.due || '9').localeCompare(b.due || '9') || b.created.localeCompare(a.created))
  const overdue = requests.filter((r) => r.direction !== 'completed' && r.due && (daysFrom(r.due) ?? 0) < 0)

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <p className="lede">Everything you’re waiting on, everything waiting on you, and every message the agent sent on your behalf.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setTicket(true)}><Plus />Raise a ticket</button>
      </div>
      <section className="panel mb16">
        <div className="statline">
          <Stat label="Waiting on you" value={<span className="row" style={{ gap: 8 }}>{counts.me}{counts.me > 0 && <span className="ring" aria-hidden />}</span>} sub="Approvals and replies you owe" />
          <Stat label="With other teams" value={requests.filter((r) => r.direction === 'waiting_on_others').length} sub={`${overdue.length} past due`} />
          <Stat label="Closed in 30 days" value={requests.filter((r) => r.direction === 'completed').length} sub="Average 2.4 days to close" />
          <Stat label="Agent sends reviewed" value={`${outbox.filter((o) => o.review).length} of ${outbox.length}`} sub={`${outbox.filter((o) => o.review === 'correct').length} marked correct`} />
        </div>
      </section>
      <div className="tabs" style={{ marginBottom: 0 }}>
        {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'on' : ''} aria-pressed={tab === t.key} onClick={() => setParams({ tab: t.key })}>{t.label}<span className="count" aria-label={`, ${counts[t.key]}`}>{counts[t.key]}</span></button>)}
      </div>
      {tab === 'outbox' ? <Outbox items={outbox} focus={params.get('o')} /> : (
        <section className="panel" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 0 }}>
          {error && !requestsRaw.length ? <LoadError what="requests" onRetry={reload} /> : loading && !requestsRaw.length ? <SkeletonRows rows={4} /> : list.length === 0 && <div className="empty">Nothing here right now.</div>}
          {list.map((r) => {
            const T = TYPE[r.type] || TYPE.ticket
            const last = r.trail[r.trail.length - 1]
            const od = r.direction !== 'completed' && r.due && (daysFrom(r.due) ?? 0) < 0
            return (
              <button key={r.id} className="req-row" onClick={() => setParams({ tab, r: r.id })}>
                <span className="acard-icon" style={{ background: 'var(--forest-wash)', color: 'var(--forest)' }}><T.icon size={15} /></span>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="strong ellipsis" style={{ display: 'block' }}>{r.title}</span>
                  <span className="tiny muted">{T.label} · {r.id} · {r.team}{r.link ? ' · ' : ''}{r.link && <EntityLink link={r.link} className="linkbtn tiny">{r.link.id}</EntityLink>}</span>
                </span>
                <span className="req-last tiny muted ellipsis">{last.by}: {last.text}</span>
                <span className="req-due tiny">{r.due ? <span className={od ? 'u-overdue-l' : 'muted'}>{od ? 'Overdue · ' : 'Due '}{when(r.due)}</span> : <span className="faint">No due date</span>}</span>
                {r.priority === 'high' && <span className="pill outline">High</span>}
                <Status s={r.status} />
              </button>
            )
          })}
        </section>
      )}
      {open && <RequestDrawer r={open} onClose={() => setParams({ tab })}
        onResolve={() => {
          const id = open.id
          setResolving((x) => new Set(x).add(id))
          setParams({ tab })
          const unset = () => setResolving((x) => { const n = new Set(x); n.delete(id); return n })
          const cancel = deferred(async () => { try { await api(`/requests/${id}/close`, { body: {} }); invalidate('/c/requests') } catch { toast(`Couldn’t resolve ${id}. Try again.`) } finally { unset() } })
          toast(<>Marked {id} as resolved. <button className="toast-undo" onClick={() => { cancel(); unset() }}>Undo</button></>)
        }} />}
      {ticket && <TicketForm onClose={() => { setTicket(false); if (params.get('ticket')) setParams({ tab: 'tickets' }) }} />}
    </main>
  )
}

function RequestDrawer({ r, onClose, onResolve }: { r: any; onClose: () => void; onResolve: () => void }) {
  const [reply, setReply] = useState('')
  const toast = useToast()
  const { busy, run } = useAction()
  const T = TYPE[r.type] || TYPE.ticket
  const op = (o: string, body?: any, msg?: string) => run(async () => { await api(`/requests/${r.id}/${o}`, { body: body || {} }); invalidate('/c/requests'); if (msg) toast(msg) }, 'That didn’t reach the team')
  const pay = Object.entries(r.payload || {}).filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['flags', 'portfolio'].includes(k))
  return (
    <Drawer title={r.title} sub={`${T.label} · ${r.id} · ${r.team}`} onClose={onClose}
      foot={r.direction !== 'completed' ? <><button className="btn btn-quiet" disabled={busy} onClick={() => op('nudge', null, `Nudged ${r.team}`)}><Bell />Nudge</button><button className="btn btn-quiet" disabled={busy} onClick={() => op('escalate', null, 'Escalated one level up')}><TriangleAlert />Escalate</button><button className="btn btn-ghost" disabled={busy} onClick={onResolve}><Check />Mark as resolved</button></> : undefined}>
      <div className="col" style={{ gap: 16 }}>
        <div className="row wrap" style={{ gap: 8 }}><Status s={r.status} />{r.priority === 'high' && <span className="pill outline">High priority</span>}{r.due && <span className="pill outline">{(daysFrom(r.due) ?? 0) < 0 ? `Overdue · due ${when(r.due).toLowerCase()}` : `Due ${when(r.due).toLowerCase()}`}</span>}{r.escalations > 0 && <span className="pill warn">Escalated ×{r.escalations}</span>}</div>
        {r.link && <EntityLink link={r.link} className="linkbtn">Open {r.link.kind} {r.link.id}<ArrowUpRight /></EntityLink>}
        {r.direction === 'waiting_on_me' && (
          <div className="note-card attention">
            <div className="small strong" style={{ marginBottom: 6 }}><CircleAlert size={14} style={{ verticalAlign: -2 }} /> {r.team} is waiting on you</div>
            {r.type === 'portfolio_approval' ? <Link className="btn btn-primary btn-sm" to={`/studio/${r.payload.portfolio_id}`}>Make the changes in Studio</Link> : (
              <><textarea className="textarea" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply or confirm what you’ve done" />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={!reply.trim() || busy} onClick={async () => { await op('respond', { text: reply }, 'Sent back to the team'); setReply('') }}>Send reply</button></>
            )}
          </div>
        )}
        {pay.length > 0 && (
          <dl className="kv small" style={{ gridTemplateColumns: '120px 1fr' }}>
            {pay.map(([k, v]) => <Fragment key={k}><dt>{k === 'bill_image' ? 'Bill' : label(k)}</dt><dd className="pre">{k === 'bill_image' ? <img src={String(v)} alt="Bill" style={{ width: 160, borderRadius: 8, border: '1px solid var(--line)' }} /> : k === 'amount' ? inr(v as number, { compact: false }) : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></Fragment>)}
          </dl>
        )}
        {r.payload?.flags?.length > 0 && <div><h3 style={{ marginBottom: 6 }}>Flags sent with it</h3>{r.payload.flags.map((f: any, i: number) => <div key={i} className={`sev ${f.severity} small`}>{f.text}</div>)}</div>}
        <div>
          <h3 style={{ marginBottom: 8 }}>Trail</h3>
          <ol className="trail">
            {r.trail.map((t: any, i: number) => <li key={i}><span className="small"><span className="strong">{t.by}</span> · {t.text}</span><span className="tiny muted">{when(t.at)}</span></li>)}
            {r.sim?.length > 0 && <li className="pending"><span className="small muted">Waiting on {r.team}…</span></li>}
          </ol>
        </div>
        {r.direction !== 'completed' && (
          <label className="check small"><input type="checkbox" checked={r.reminders !== false} onChange={() => op('reminders', null, r.reminders !== false ? 'Auto-reminders off' : 'Auto-reminders on')} /><AlarmClockCheck size={14} />Remind {r.team} automatically every 24 hours until it moves</label>
        )}
        <p className="tiny faint">Other teams’ replies in this preview are simulated so you can see a request move end to end.</p>
      </div>
    </Drawer>
  )
}

function TicketForm({ onClose }: { onClose: () => void }) {
  const { data: clients = [] } = useClients()
  const [f, setF] = useState({ team: 'Operations', client_id: '', priority: 'normal', subject: '', summary: '', due: '', attachments: [] as string[] })
  const toast = useToast()
  const { busy, run } = useAction()
  const save = () => run(async () => {
    const r = await api('/actions/create_ticket', { body: { ...f, client_id: f.client_id || undefined, due: f.due || undefined } })
    invalidate('/c/requests')
    toast(`${r.request.id} raised with the ${f.team} team lead`)
    onClose()
  }, 'Couldn’t raise the ticket')
  return (
    <Modal title="Raise a ticket" sub="Goes to the team lead, who assigns it inside the team." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.subject.trim() || busy} onClick={save}>{busy ? 'Raising…' : 'Raise ticket'}</button></>}>
      <div className="grid g2" style={{ gap: 12 }}>
        <label className="field"><span>Team</span><select className="select" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Client (optional)</span><select className="select" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}><option value="">Not about a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Subject</span><input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. SIP failed for Arvind Iyer" /></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Summary</span><textarea className="textarea" rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="What happened, what you’ve tried, what you need" /></label>
        <div className="field"><span>Priority</span><div className="seg"><button className={f.priority === 'normal' ? 'on' : ''} onClick={() => setF({ ...f, priority: 'normal' })}>Normal</button><button className={f.priority === 'high' ? 'on' : ''} onClick={() => setF({ ...f, priority: 'high' })}>High</button></div></div>
        <label className="field"><span>Needed by</span><input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Attachments</span><input className="input" type="file" multiple onChange={(e) => setF({ ...f, attachments: [...(e.target.files || [])].map((x) => x.name) })} style={{ paddingTop: 7 }} /></label>
        <div className="row tiny muted" style={{ gridColumn: '1 / -1', gap: 8 }}><span className="pill outline"><Mic size={11} />Speak a ticket</span><span className="pill outline">Draft with AI</span>Coming soon</div>
      </div>
    </Modal>
  )
}

const ACTION_ICON: Record<string, any> = { schedule_meeting: AlarmClockCheck, send_message: MessageSquare, send_mom: NotebookPen, product_feedback: Send, reimbursement: Receipt, service_request: Headset, portfolio_approval: LayoutGrid }
function Outbox({ items, focus }: { items: any[]; focus: string | null }) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(focus)
  const shown = useMemo(() => [...items].filter((o) => !filter || (filter === 'none' ? !o.review : o.review === filter)).sort((a, b) => b.at.localeCompare(a.at)), [items, filter])
  return (
    <section className="panel" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 0 }}>
      <div className="list-toolbar">
        <p className="small muted grow">Exactly what each approved action produced, with what you said and the card it came from. Mark each one so we can measure the agent.</p>
        <div className="row" style={{ gap: 6 }}>{[['', 'All'], ['none', `To review (${items.filter((o) => !o.review).length})`], ['correct', 'Correct'], ['fix', 'Needs fixing']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
      </div>
      {shown.length === 0 && <div className="empty">Nothing here yet. Approve a card in any agent session and it lands here.</div>}
      {shown.map((o) => <OutboxItem key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />)}
    </section>
  )
}

function OutboxItem({ o, open, onToggle }: { o: any; open: boolean; onToggle: () => void }) {
  const [subject, setSubject] = useState(o.subject || '')
  const [body, setBody] = useState(o.body || '')
  const [note, setNote] = useState(o.review_note || '')
  const [raw, setRaw] = useState(false)
  const toast = useToast()
  const { busy, run } = useAction()
  const Icon = ACTION_ICON[o.action] || FileText
  const save = (patch: any, msg: string) => run(async () => { await api(`/outbox/${o.id}`, { method: 'PATCH', body: patch }); invalidate('/c/outbox'); toast(msg) }, 'Couldn’t save that')
  const href = o.source?.kind && o.source?.id ? { kind: o.source.kind, id: o.source.id } : null
  return (
    <div className={`ob ${open ? 'open' : ''}`}>
      <button className="ob-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="acard-icon"><Icon size={14} /></span>
        <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <span className="small strong ellipsis" style={{ display: 'block' }}>{o.subject || label(o.action)}</span>
          <span className="tiny muted">{o.channel} to {o.to?.name}{o.to?.address ? ` (${o.to.address})` : ''} · {when(o.at)} · {o.id}</span>
        </span>
        {o.source?.card_id && <span className="pill brass"><span className="ring" style={{ width: 8, height: 8 }} />Agent</span>}
        {o.edited && <span className="pill outline">Edited</span>}
        {o.review === 'correct' && <span className="pill gain"><Check size={11} />Correct</span>}
        {o.review === 'fix' && <span className="pill loss">Needs fixing</span>}
      </button>
      {open && (
        <div className="ob-body">
          {o.source?.said && <div className="said"><span className="tiny muted">You said</span><p className="small">“{o.source.said}”</p></div>}
          <div className="tiny muted" style={{ margin: '4px 0 6px' }}>{o.source?.card_id ? <>From card {o.source.card_id} in session {o.source.session_id}{href && <> · <EntityLink link={href} className="linkbtn tiny">open {href.kind}</EntityLink></>}</> : 'Sent by hand from an Actions panel or the Studio'}</div>
          <div className="mail">
            <div className="mail-row"><span className="muted">To</span><span>{o.to?.name} &lt;{o.to?.address}&gt; via {o.channel}</span></div>
            {o.subject !== null && <div className="mail-row"><span className="muted">Subject</span><input className="input sm" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
            <textarea className="textarea" rows={Math.min(14, body.split('\n').length + 2)} value={body} onChange={(e) => setBody(e.target.value)} />
            {(subject !== (o.subject || '') || body !== (o.body || '')) && <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => save({ subject, body }, 'Edits saved; the original is kept')}>Save edits</button>}
            {o.original && <p className="tiny muted">Edited after sending. Original kept for the review set.</p>}
          </div>
          <button className="linkbtn tiny" style={{ marginTop: 8 }} onClick={() => setRaw((x) => !x)}><Code size={12} />{raw ? 'Hide' : 'Show'} payload JSON</button>
          {raw && <pre className="json">{JSON.stringify(o, null, 2)}</pre>}
          <div className="review">
            <span className="small strong">Did the agent get this right?</span>
            <button className={`btn btn-sm ${o.review === 'correct' ? 'btn-primary' : 'btn-quiet'}`} onClick={() => save({ review: 'correct', review_note: note }, 'Marked correct')}><Check />Correct</button>
            <button className={`btn btn-sm ${o.review === 'fix' ? 'btn-brass' : 'btn-quiet'}`} onClick={() => save({ review: 'fix', review_note: note }, 'Marked as needing a fix')}>Needs fixing</button>
            <input className="input sm grow" placeholder="What was wrong? (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => o.review && note !== (o.review_note || '') && save({ review: o.review, review_note: note }, 'Note saved')} />
          </div>
        </div>
      )}
    </div>
  )
}
