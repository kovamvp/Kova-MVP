import { ReactNode, useEffect, useState } from 'react'
import { CalendarPlus, FileText, Lock, Headset, MessageSquare, NotebookPen, Receipt, Send, Sparkles, UserCog } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { date, time } from '../lib/format'
import { useProducts } from '../lib/data'
import { useToast } from '../ui'

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

/* Actions panel: manual versions of everything the agent can do */
export function ActionsPanel({ kind, id, name, initial, onAskAgent, productId }: { kind: 'client' | 'prospect'; id: string; name: string; initial?: string | null; onAskAgent: (prompt: string) => void; productId?: string }) {
  const [open, setOpen] = useState<string | null>(initial || null)
  useEffect(() => { if (initial) setOpen(initial) }, [initial])
  const items = [
    { key: 'schedule', icon: CalendarPlus, label: 'Schedule a meeting', works: true },
    { key: 'feedback', icon: Send, label: 'Send feedback to a product team', works: true },
    { key: 'note', icon: FileText, label: 'Add an internal note', works: true },
    { key: 'message', icon: MessageSquare, label: 'Send a WhatsApp or email', prompt: `Draft a short message to ${name} about ` },
    { key: 'mom', icon: NotebookPen, label: 'Record minutes of a meeting', prompt: `Log the MoM for my meeting with ${name}: ` },
    ...(kind === 'client' ? [
      { key: 'reimb', icon: Receipt, label: 'Claim a reimbursement', prompt: `I want to claim a reimbursement for my meeting with ${name}. ` },
      { key: 'service', icon: Headset, label: 'Raise a service request', prompt: `Raise a service request for ${name}: ` },
    ] : [{ key: 'stage', icon: UserCog, label: 'Change stage or next step', prompt: `Update ${name}: ` }]),
  ]
  return (
    <div className="col" style={{ gap: 8 }}>
      <p className="small muted" style={{ marginBottom: 6 }}>Everything the agent can do, done by hand. In this version three actions run directly; the rest open the agent with a head start.</p>
      {items.map((it) => (
        <div key={it.key} className={`action-item ${open === it.key ? 'open' : ''}`}>
          <button className="action-head" onClick={() => (it.works ? setOpen(open === it.key ? null : it.key) : onAskAgent((it as any).prompt))}>
            <span className="acard-icon"><it.icon size={15} /></span>
            <span className="grow" style={{ textAlign: 'left' }}>{it.label}</span>
            {!it.works && <span className="pill brass"><Sparkles size={11} />With the agent</span>}
          </button>
          {open === it.key && it.key === 'schedule' && <ScheduleForm kind={kind} id={id} name={name} onDone={() => setOpen(null)} />}
          {open === it.key && it.key === 'feedback' && <FeedbackForm clientId={kind === 'client' ? id : undefined} productId={productId} onDone={() => setOpen(null)} />}
          {open === it.key && it.key === 'note' && <NoteForm kind={kind} id={id} onDone={() => setOpen(null)} />}
        </div>
      ))}
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
