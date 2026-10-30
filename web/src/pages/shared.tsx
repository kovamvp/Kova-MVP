import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, FileText, Lock, Headset, MessageSquare, NotebookPen, Receipt, Send, UserCog } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { date, nowISO, time, when } from '../lib/format'
import { STAGES, useMeetings, useProducts } from '../lib/data'
import { useToast } from '../ui'
import { ReimbursementForm } from './Expense'

/* The floating bar on client, prospect and product pages */
export function ContextBar({ children, onAgent, agentOn }: { children: ReactNode; onAgent: () => void; agentOn?: boolean }) {
  return (
    <div className="ctxbar-wrap">
      <div className="ctxbar">
        {children}
        <span className="sep" />
        <button className={`orb ${agentOn ? 'on' : ''}`} onClick={onAgent} aria-label="Open the agent" title="Agent: speak or type" />
      </div>
    </div>
  )
}

function nextSlot() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(11, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T11:00`
}

/* Actions panel: every action the agent can propose, done by hand. Each runs the same server code as an approved agent card. */
export function ActionsPanel({ kind, id, name, initial, onAskAgent, productId }: { kind: 'client' | 'prospect'; id: string; name: string; initial?: string | null; onAskAgent: (prompt: string) => void; productId?: string }) {
  const [open, setOpen] = useState<string | null>(initial || null)
  useEffect(() => { if (initial) setOpen(initial) }, [initial])
  const items = [
    { key: 'schedule', icon: CalendarPlus, label: 'Schedule a meeting' },
    { key: 'message', icon: MessageSquare, label: 'Send a WhatsApp or email' },
    { key: 'mom', icon: NotebookPen, label: 'Record minutes of a meeting' },
    { key: 'feedback', icon: Send, label: 'Send feedback to a product team' },
    { key: 'note', icon: FileText, label: 'Add an internal note' },
    ...(kind === 'client'
      ? [{ key: 'reimb', icon: Receipt, label: 'Claim a reimbursement' }, { key: 'service', icon: Headset, label: 'Raise a service request' }]
      : [{ key: 'stage', icon: UserCog, label: 'Change stage or next step' }]),
  ]
  const done = () => setOpen(null)
  return (
    <div className="col" style={{ gap: 8 }}>
      <p className="small muted" style={{ marginBottom: 6 }}>Everything the agent can do, done by hand. Each one lands in the outbox exactly as an approved agent card would.</p>
      {items.map((it) => (
        <div key={it.key} className={`action-item ${open === it.key ? 'open' : ''}`}>
          <button className="action-head" aria-expanded={open === it.key} onClick={() => setOpen(open === it.key ? null : it.key)}>
            <span className="acard-icon"><it.icon size={15} /></span>
            <span className="grow" style={{ textAlign: 'left' }}>{it.label}</span>
          </button>
          {open === it.key && it.key === 'schedule' && <ScheduleForm kind={kind} id={id} name={name} onDone={done} />}
          {open === it.key && it.key === 'message' && <MessageForm kind={kind} id={id} onDone={done} />}
          {open === it.key && it.key === 'mom' && <MomForm kind={kind} id={id} onDone={done} />}
          {open === it.key && it.key === 'feedback' && <FeedbackForm clientId={kind === 'client' ? id : undefined} productId={productId} onDone={done} />}
          {open === it.key && it.key === 'note' && <NoteForm kind={kind} id={id} onDone={done} />}
          {open === it.key && it.key === 'reimb' && <ReimbursementForm clientId={id} clientName={name} onDone={done} />}
          {open === it.key && it.key === 'service' && <ServiceForm clientId={id} onDone={done} />}
          {open === it.key && it.key === 'stage' && <StageForm id={id} onDone={done} />}
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 8 }}>
        Rather say it? <button className="linkbtn" onClick={() => onAskAgent('')}>Open the agent</button> and describe what you need; it prepares the same actions as cards for you to approve.
      </p>
    </div>
  )
}

/* WhatsApp only with the client's consent; the server enforces it too */
function MessageForm({ kind, id, onDone }: { kind: 'client' | 'prospect'; id: string; onDone: () => void }) {
  const { data: who } = useApi<any>(`/c/${kind === 'client' ? 'clients' : 'prospects'}/${id}`)
  const waAllowed = !!who?.consent?.whatsapp // clients and prospects alike; the server enforces it too
  const [channel, setChannel] = useState<'Email' | 'WhatsApp'>('Email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const { busy, run } = useAction()
  const toast = useToast()
  const save = () => run(async () => {
    await api('/actions/send_message', { body: { to_kind: kind, to_id: id, channel, subject: channel === 'Email' ? subject : undefined, body } })
    invalidate('/c/')
    toast(`${channel === 'Email' ? 'Email' : 'WhatsApp'} placed in the outbox`)
    onDone()
  }, 'The message wasn’t sent')
  return (
    <div className="action-form">
      <div className="seg" role="group" aria-label="Channel">
        <button className={channel === 'Email' ? 'on' : ''} aria-pressed={channel === 'Email'} onClick={() => setChannel('Email')}>Email</button>
        <button className={channel === 'WhatsApp' ? 'on' : ''} aria-pressed={channel === 'WhatsApp'} disabled={!waAllowed} onClick={() => setChannel('WhatsApp')}>WhatsApp</button>
      </div>
      {!waAllowed && who && <p className="tiny muted">{who.first_name || who.name} hasn’t consented to WhatsApp, so this goes by email.</p>}
      {channel === 'Email' && <label className="field"><span>Subject</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}
      <label className="field"><span>Message</span><textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Hi ${who?.first_name || ''},`} /></label>
      <div className="row"><button className="btn btn-primary" disabled={busy || !body.trim()} onClick={save}>{channel === 'Email' ? 'Send email' : 'Send WhatsApp'}</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

/* MoM for a meeting that has happened; attaches to it, or records a conversation if none is picked */
function MomForm({ kind, id, onDone }: { kind: 'client' | 'prospect'; id: string; onDone: () => void }) {
  const { data: meetings = [] } = useMeetings()
  const now = nowISO()
  const past = meetings.filter((m: any) => m.with?.kind === kind && m.with?.id === id && m.start <= now && !m.mom).sort((a: any, b: any) => b.start.localeCompare(a.start))
  const [mid, setMid] = useState<string>('')
  useEffect(() => { if (!mid && past[0]) setMid(past[0].id) }, [past.length]) // eslint-disable-line
  const [f, setF] = useState({ summary: '', feedback: '', promises: '', promise_due: '', send_to_client: kind === 'client' })
  const { busy, run } = useAction()
  const toast = useToast()
  const save = () => run(async () => {
    await api('/actions/log_mom', { body: { with_kind: kind, with_id: id, meeting_id: mid || undefined, summary: f.summary, feedback: f.feedback,
      promises: f.promises.split('\n').map((x) => x.trim()).filter(Boolean), promise_due: f.promise_due || undefined, send_to_client: f.send_to_client } })
    invalidate('/c/')
    toast(f.send_to_client ? 'MoM recorded and placed in the outbox for the client' : 'MoM recorded')
    onDone()
  }, 'The MoM wasn’t recorded')
  return (
    <div className="action-form">
      <label className="field"><span>Meeting</span>
        <select className="select" value={mid} onChange={(e) => setMid(e.target.value)}>
          {past.map((m: any) => <option key={m.id} value={m.id}>{m.title} · {when(m.start)}</option>)}
          <option value="">A conversation not on the calendar</option>
        </select>
      </label>
      <label className="field"><span>What was discussed</span><textarea className="textarea" rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
      <label className="field"><span>How they reacted</span><input className="input" value={f.feedback} placeholder="Liked the proposal, worried about fees…" onChange={(e) => setF({ ...f, feedback: e.target.value })} /></label>
      <label className="field"><span>What you promised, one per line</span><textarea className="textarea" rows={2} value={f.promises} onChange={(e) => setF({ ...f, promises: e.target.value })} /></label>
      {f.promises.trim() && <label className="field"><span>Promised by</span><input className="input" type="date" value={f.promise_due} onChange={(e) => setF({ ...f, promise_due: e.target.value })} /></label>}
      {kind === 'client' && <label className="check small"><input type="checkbox" checked={f.send_to_client} onChange={(e) => setF({ ...f, send_to_client: e.target.checked })} />Send the MoM to the client</label>}
      <div className="row"><button className="btn btn-primary" disabled={busy || !f.summary.trim()} onClick={save}>{f.send_to_client ? 'Record and send' : 'Record MoM'}</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

export const SERVICE_CATEGORIES = ['Demographic update', 'Family details update', 'Nominee update', 'Bank account change', 'KYC re-verification',
  'Statement or certificate', 'Transaction issue', 'SIP or STP change', 'Other'] // same list as backend/profile.py

function ServiceForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [params] = useSearchParams()
  const pre = params.get('category')
  const [f, setF] = useState({ category: pre && SERVICE_CATEGORIES.includes(pre) ? pre : 'Demographic update', title: params.get('what') || '', details: '', priority: 'normal' })
  const { busy, run } = useAction()
  const toast = useToast()
  const save = () => run(async () => {
    await api('/actions/service_request', { body: { client_id: clientId, ...f } })
    invalidate('/c/')
    toast('Service request sent to Client Experience. Track it in Requests.')
    onDone()
  }, 'The request wasn’t raised')
  return (
    <div className="action-form">
      <label className="field"><span>Type of request</span>
        <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="field"><span>What’s needed</span><input className="input" value={f.title} placeholder="New address, add a nominee, capital gains statement…" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field"><span>Details for Client Experience</span><textarea className="textarea" rows={3} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
      <div className="seg" role="group" aria-label="Priority"><button className={f.priority === 'normal' ? 'on' : ''} aria-pressed={f.priority === 'normal'} onClick={() => setF({ ...f, priority: 'normal' })}>Normal</button><button className={f.priority === 'high' ? 'on' : ''} aria-pressed={f.priority === 'high'} onClick={() => setF({ ...f, priority: 'high' })}>High priority</button></div>
      <div className="row"><button className="btn btn-primary" disabled={busy || !f.details.trim()} onClick={save}>Raise request</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

function StageForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { data: p } = useApi<any>(`/c/prospects/${id}`)
  const [f, setF] = useState<{ stage: string; next_step: string; next_step_date: string } | null>(null)
  useEffect(() => { if (p && !f) setF({ stage: p.stage, next_step: p.next_step || '', next_step_date: (p.next_step_date || '').slice(0, 10) }) }, [p, f])
  const { busy, run } = useAction()
  const toast = useToast()
  if (!f) return <div className="action-form small muted">Loading…</div>
  const save = () => run(async () => {
    await api('/actions/update_prospect', { body: { prospect_id: id, stage: f.stage !== p.stage ? f.stage : undefined, next_step: f.next_step, next_step_date: f.next_step_date || undefined } })
    invalidate('/c/')
    toast('Prospect updated')
    onDone()
  }, 'The prospect wasn’t updated')
  return (
    <div className="action-form">
      <label className="field"><span>Stage</span><select className="select" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field"><span>Next step</span><input className="input" value={f.next_step} onChange={(e) => setF({ ...f, next_step: e.target.value })} /></label>
        <label className="field"><span>By</span><input className="input" type="date" value={f.next_step_date} onChange={(e) => setF({ ...f, next_step_date: e.target.value })} /></label>
      </div>
      <div className="row"><button className="btn btn-primary" disabled={busy} onClick={save}>Save changes</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

export function ScheduleForm({ kind, id, name, onDone }: { kind: 'client' | 'prospect'; id: string; name: string; onDone: () => void }) {
  const [f, setF] = useState({ title: `Review with ${name}`, type: kind === 'prospect' ? 'First meeting' : 'Review', start: nextSlot(), duration_minutes: 45, location: '', agenda: '' })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const save = async () => {
    setBusy(true)
    try {
      await api('/actions/schedule_meeting', { body: { with_kind: kind, with_id: id, ...f, agenda: f.agenda.split('\n').filter(Boolean) } })
      invalidate('/c/')
      toast(<>Meeting scheduled and invite placed in the outbox</>)
      onDone()
    } catch (e: any) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="action-form">
      <label className="field"><span>Title</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field"><span>When</span><input className="input" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label className="field"><span>Length</span><select className="select" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: +e.target.value })}>{[20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
        <label className="field"><span>Type</span><select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['Review', 'Proposal', 'First meeting', 'Service', 'Family meeting'].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Where</span><input className="input" value={f.location} placeholder="Their office, Kova office, phone" onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
      </div>
      <label className="field"><span>Agenda, one point per line</span><textarea className="textarea" rows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></label>
      <div className="row"><button className="btn btn-primary" disabled={busy} onClick={save}>Schedule and send invite</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

export function FeedbackForm({ clientId, productId, onDone }: { clientId?: string; productId?: string; onDone: () => void }) {
  const { data: products = [] } = useProducts()
  const [pid, setPid] = useState(productId || '')
  const [text, setText] = useState('')
  const [prio, setPrio] = useState('normal')
  const toast = useToast()
  const save = async () => {
    try {
      await api('/actions/product_feedback', { body: { product_id: pid || undefined, feedback: text, client_id: clientId, priority: prio } })
      invalidate('/c/')
      toast('Feedback sent to the product team. Track it in Requests.')
      onDone()
    } catch (e: any) { toast(e.message) }
  }
  return (
    <div className="action-form">
      <label className="field"><span>Product</span>
        <select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">General feedback</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field"><span>What should the product team know?</span><textarea className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the client said, what’s missing, what would help you sell it" /></label>
      <div className="seg"><button className={prio === 'normal' ? 'on' : ''} onClick={() => setPrio('normal')}>Normal</button><button className={prio === 'high' ? 'on' : ''} onClick={() => setPrio('high')}>High priority</button></div>
      <div className="row"><button className="btn btn-primary" disabled={!text.trim()} onClick={save}>Send feedback</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

function NoteForm({ kind, id, onDone }: { kind: string; id: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const toast = useToast()
  const save = async () => {
    await api('/actions/add_note', { body: { about_kind: kind, about_id: id, text } })
    invalidate('/c/')
    toast('Note added to the timeline')
    onDone()
  }
  return (
    <div className="action-form">
      <textarea className="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Only visible inside Kova" />
      <div className="row"><button className="btn btn-primary" disabled={!text.trim()} onClick={save}>Add note</button><button className="btn btn-ghost" onClick={onDone}>Cancel</button></div>
    </div>
  )
}

/* colour-coded timeline */
const TL_KINDS = [
  { key: 'note', label: 'Internal notes' }, { key: 'comm', label: 'Sent to client' }, { key: 'client', label: 'Client actions' },
  { key: 'agent', label: 'Agent actions' }, { key: 'system', label: 'System' },
]
export function Timeline({ items }: { items: any[] }) {
  const [off, setOff] = useState<Set<string>>(new Set())
  const shown = items.filter((e) => !off.has(e.kind))
  return (
    <div>
      <div className="tl-legend">
        {TL_KINDS.map((k) => (
          <button key={k.key} className={`tl-key k-${k.key} ${off.has(k.key) ? 'off' : ''}`} onClick={() => setOff((s) => { const n = new Set(s); n.has(k.key) ? n.delete(k.key) : n.add(k.key); return n })} aria-pressed={!off.has(k.key)}>
            <i />{k.label}
          </button>
        ))}
      </div>
      <ol className="timeline">
        {shown.map((e) => (
          <li key={e.id + e.at} className={`tl k-${e.kind}`}>
            <div className="tl-dot" />
            <div className="tl-card">
              <div className="spread">
                <span className="small strong row" style={{ gap: 6 }}>{e.kind === 'note' && <Lock size={12} aria-label="Internal" />}{e.title}{e.channel ? ` · ${e.channel}` : ''}</span>
                <span className="tiny muted num">{date(e.at)}{e.at.length > 10 ? `, ${time(e.at.slice(0, 16))}` : ''}</span>
              </div>
              {e.body && <p className="small pre" style={{ marginTop: 4 }}>{e.body}</p>}
              {e.by && <div className="tiny muted" style={{ marginTop: 4 }}>{e.by}</div>}
            </div>
          </li>
        ))}
        {shown.length === 0 && <div className="empty small">Nothing to show with these filters.</div>}
      </ol>
    </div>
  )
}
