import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowLeft, ArrowUp, CalendarPlus, Check, FileText, HandCoins, Headset, Loader2, Mail, MessageSquare, Mic, NotebookPen, Paperclip, Pencil, Plus, Receipt, RotateCcw, Send, Square, UserCog, X } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { ago, date, inr, label, time, when } from '../lib/format'
import { resizeImage } from '../shell/ProfileMenu'
import { Drawer, Status, useToast } from '../ui'
import { useSpeech } from './useSpeech'
import { BillSlot, Checks, readBill } from '../pages/Expense'

export type Scope = { kind: 'client' | 'prospect' | 'product'; id: string }

const ACTION_META: Record<string, { icon: any; label: string }> = {
  schedule_meeting: { icon: CalendarPlus, label: 'Schedule meeting' },
  send_message: { icon: MessageSquare, label: 'Message' },
  log_mom: { icon: NotebookPen, label: 'Minutes of meeting' },
  product_feedback: { icon: Send, label: 'Feedback to product team' },
  reimbursement: { icon: Receipt, label: 'Reimbursement' },
  service_request: { icon: Headset, label: 'Service request' },
  add_note: { icon: FileText, label: 'Internal note' },
  update_prospect: { icon: UserCog, label: 'Update prospect' },
}
const FIELD_LABEL: Record<string, string> = {
  with_id: 'With', to_id: 'To', about_id: 'About', client_id: 'Client', product_id: 'Product', prospect_id: 'Prospect', start: 'When', duration_minutes: 'Minutes',
  send_to_client: 'Send to client', promise_due: 'Promises due', changes_asked: 'Changes asked', portfolio_reaction: 'Portfolio reaction', bill_date: 'Bill date',
  next_step_date: 'Next step date', estimated_investable: 'Estimated investable', interest_product_id: 'Interested in', meeting_id: 'Meeting',
}
const HIDE = new Set(['with_kind', 'to_kind', 'about_kind'])
const ORDER = ['with_id', 'to_id', 'about_id', 'client_id', 'prospect_id', 'product_id', 'channel', 'title', 'type', 'start', 'duration_minutes', 'location', 'attendees', 'agenda', 'subject', 'body', 'summary', 'feedback', 'portfolio_reaction', 'changes_asked', 'promises', 'promise_due', 'personal', 'send_to_client', 'category', 'merchant', 'amount', 'bill_date', 'gst', 'details', 'text', 'priority']
const rank = (k: string) => { const i = ORDER.indexOf(k); return i < 0 ? 99 : i }
const LONG = new Set(['body', 'summary', 'feedback', 'text', 'details', 'personal'])

const SUGGEST: Record<string, string[]> = {
  client: ['Log the MoM from today’s meeting and send it to them', 'Schedule a review next Tuesday at 4 pm at their office', 'Tell the product team they found the PMS fee too high', 'What’s maturing for them in the next two months?'],
  prospect: ['Draft a WhatsApp nudge about the fund they viewed', 'Book a first meeting on Thursday at 11', 'Move them to KYC in progress; next step is the FATCA form', 'Prepare me for the first meeting'],
  product: ['Give me the 10-minute brief', 'Which of my clients does this suit?', 'Tell the product manager clients want a monthly payout option', 'What should I say if a client asks about fees?'],
}

/* what the agent looked at, in words (W11) */
const READ_WORDS: Record<string, string> = {
  get_holdings: 'holdings', get_family: 'family', get_meetings: 'meetings', get_calendar: 'calendar', find_products: 'the product shelf',
  get_product: 'the product', clients_for_product: 'clients who fit', get_open_requests: 'open requests',
}
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
/* decisions read as the RM's own (W12): structured events when the server sends them, otherwise the older sentence */
function eventText(m: any): string {
  const d = m.decision
  if (d && d.decision) return `You ${d.decision === 'approve' ? 'approved' : 'rejected'} “${d.summary || d.card_id}”${d.edited ? ', with edits' : ''}${d.reason ? `: ${d.reason}` : ''}`
  const r = /^RM (approved|rejected) card (CD-\d+) \((.*?)\)( with edits)?(?::\s*(.*))?$/.exec(m.text || '')
  if (r) return `You ${r[1]} “${r[3]}”${r[4] ? ', with edits' : ''}${r[5] ? `: ${r[5]}` : ''}`
  return m.text
}
/* a model failure is an error row with Try again, not a normal reply */
const isAgentError = (m: any) => m.role === 'agent' && (m.error === true || /^I couldn.t reach the language model/i.test(m.text || ''))

function md(text: string): ReactNode {
  // minimal: paragraphs, bullets, **bold**
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))
  const blocks = text.replace(/<br\s*\/?>/gi, '\n').split(/\n{2,}/)
  return blocks.map((b, i) => {
    const lines = b.split('\n')
    if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|'))) {
      const rows = lines.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
      return (
        <div key={i} className="md-table"><table className="table"><thead><tr>{rows[0].map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>
      )
    }
    if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>)}</ul>
    if (/^#{1,4}\s/.test(lines[0])) return <div key={i}><h4>{inline(lines[0].replace(/^#+\s/, ''))}</h4>{lines.slice(1).map((l, j) => <p key={j}>{inline(l.replace(/^\s*[-*•]\s+/, '· '))}</p>)}</div>
    return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>
  })
}

export default function AgentPanel({ scope, name, onClose, allowBill, names = {}, initialText }: { scope: Scope; name: string; onClose: () => void; allowBill?: boolean; names?: Record<string, string>; initialText?: string | null }) {
  const [sessions, setSessions] = useState<any[] | null>(null)
  const [archived, setArchived] = useState(false)
  const [sess, setSess] = useState<any>(null)
  const toast = useToast()
  const loadList = useCallback(() => api(`/agent/sessions?kind=${scope.kind}&id=${scope.id}&archived=${archived}`).then(setSessions), [scope, archived])
  useEffect(() => { loadList() }, [loadList])
  const started = useRef(false)
  useEffect(() => {
    if (initialText && !started.current) { started.current = true; api('/agent/sessions', { body: scope }).then(setSess) }
  }, [initialText, scope])
  const open = async (id: string) => setSess(await api(`/agent/sessions/${id}`))
  const create = async () => setSess(await api('/agent/sessions', { body: scope }))

  return (
    <Drawer wide scrim={false} onClose={onClose}
      title={<div className="row" style={{ gap: 12 }}><span className="orb sm" aria-hidden /><div><h2>{sess ? sess.title : 'Agent'}</h2><div className="tiny muted">{name} · {scope.kind} agent</div></div></div>}>
      {!sess ? (
        <div>
          <button className="new-session" onClick={create}>
            <span className="orb" aria-hidden />
            <span className="grow" style={{ textAlign: 'left' }}><span className="strong" style={{ display: 'block' }}>New session</span><span className="small muted">Speak or type. Anything the agent wants to do comes to you as a card to approve.</span></span>
            <Plus size={18} />
          </button>
          <div className="spread" style={{ margin: '22px 0 8px' }}>
            <h3>{archived ? 'Archived sessions' : 'Past sessions'}</h3>
            <button className="linkbtn small" onClick={() => setArchived((a) => !a)}>{archived ? 'Show current' : 'Show archived'}</button>
          </div>
          {sessions === null && <div className="small muted">Loading…</div>}
          {sessions?.length === 0 && <div className="empty small">{archived ? 'Nothing archived.' : `No sessions yet for ${name}.`}</div>}
          <div className="col" style={{ gap: 0 }}>
            {sessions?.map((s) => (
              <button key={s.id} className="session-row" onClick={() => open(s.id)}>
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="strong ellipsis" style={{ display: 'block' }}>{s.title}</span>
                  <span className="tiny muted">{ago(s.updated)} · {s.card_count} card{s.card_count === 1 ? '' : 's'}</span>
                </span>
                <span className="tiny faint">{s.id}</span>
              </button>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: 18 }}>Sessions are kept for the audit trail. You can archive them but not delete them.</p>
        </div>
      ) : (
        <Chat sess={sess} setSess={setSess} scope={scope} name={name} allowBill={allowBill} names={names} initialText={initialText}
          onBack={() => { setSess(null); loadList() }}
          onArchive={async () => { await api(`/agent/sessions/${sess.id}/archive`, { method: 'POST' }); toast(sess.archived ? 'Session restored' : 'Session archived'); setSess(null); loadList() }} />
      )}
    </Drawer>
  )
}

function Chat({ sess, setSess, scope, name, allowBill, onBack, onArchive, names, initialText }: { sess: any; setSess: (s: any) => void; scope: Scope; name: string; allowBill?: boolean; onBack: () => void; onArchive: () => void; names: Record<string, string>; initialText?: string | null }) {
  const [text, setText] = useState(sess.messages.length === 0 && initialText ? initialText : '')
  const [via, setVia] = useState<'text' | 'voice'>('text')
  const [transcript, setTranscript] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [bill, setBill] = useState<any>(null)
  const [billBusy, setBillBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()
  const speech = useSpeech(useCallback((t: string, meta: any) => {
    setText((prev) => (prev ? prev + ' ' : '') + t)
    setVia('voice')
    setTranscript(meta)
    setTimeout(() => ta.current?.focus(), 50)
  }, []))

  const scroller = useRef<HTMLDivElement>(null)
  const seen = useRef(sess.messages.length)
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const card = box.querySelector<HTMLElement>('.acard.pending')
    if (card) box.scrollTop = Math.max(0, card.offsetTop - 16)
    else box.scrollTop = box.scrollHeight
  }, [])
  useEffect(() => {
    if (sess.messages.length > seen.current || busy) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    seen.current = sess.messages.length
  }, [sess.messages.length, busy])
  /* slow model calls: say what is happening, in words that change with the wait */
  const [waited, setWaited] = useState(0)
  useEffect(() => {
    if (!busy) { setWaited(0); return }
    const t0 = Date.now()
    const t = window.setInterval(() => setWaited(Math.floor((Date.now() - t0) / 1000)), 500)
    return () => window.clearInterval(t)
  }, [busy])
  const who = scope.kind === 'product' ? 'the product and your clients' : `${name.split(' ')[0]}’s ${scope.kind === 'client' ? 'holdings, calendar and requests' : 'details, calendar and requests'}`
  const waitText = waited < 4 ? 'Thinking…' : waited < 12 ? `Looking at ${who}…` : 'The model is busy; this can take up to half a minute. Your message is saved.'

  const send = async (override?: string) => {
    const t = (override ?? text).trim()
    if ((!t && !bill) || busy) return
    setBusy(true)
    const optimistic = { ...sess, messages: [...sess.messages, { id: 'tmp', role: 'rm', text: t || 'Here’s a bill for reimbursement.', at: new Date().toISOString(), via, bill: bill ? { thumb: bill.thumb, fields: bill.fields } : undefined }] }
    setSess(optimistic)
    setText(''); setTranscript(null)
    try {
      const s = await api(`/agent/sessions/${sess.id}/message`, { body: { text: t, via, transcript, bill: bill ? { thumb: bill.thumb, fields: bill.fields } : undefined } })
      setSess(s)
      setBill(null); setVia('text')
    } catch (e: any) {
      toast(`Couldn’t send: ${e.message}. Your words are back in the box; try again.`)
      setSess(sess); setText(t)
    } finally { setBusy(false) }
  }

  const attach = async (f?: File) => {
    if (!f) return
    setBillBusy(true)
    try {
      const image = await resizeImage(f, 1400, 0.85)
      const thumb = await resizeImage(f, 480, 0.7)
      const r = await api('/agent/read-bill', { body: { image } })
      setBill({ thumb, fields: r.fields || {} })
      if (r.fields?.confidence === 'low') toast('The bill was hard to read. Check the amounts on the card before approving.')
    } catch (e: any) { toast(`Couldn’t read the bill: ${e.message}`) }
    finally { setBillBusy(false); if (file.current) file.current.value = '' }
  }

  /* a reimbursement card holds its own bill: add or replace it on the card */
  const addBill = async (card: any, f: File) => {
    try {
      const { bill: b, note } = await readBill(f)
      setSess(await api(`/agent/sessions/${sess.id}/cards/${card.id}/bill`, { body: b }))
      if (note) toast(note)
    } catch (e: any) { toast(`The bill wasn’t attached. ${e.message}. Try again.`) }
  }

  const decide = async (card: any, decision: 'approve' | 'reject', args?: any, reason?: string) => {
    try {
      const s = await api(`/agent/sessions/${sess.id}/cards/${card.id}`, { body: { decision, args, ...(reason ? { reason } : {}) } })
      setSess(s)
      invalidate('/c/')
      toast(decision === 'approve' ? <>Done. <Link to={`/requests?tab=outbox`}>See it in the outbox</Link></> : 'Card rejected; nothing was sent')
    } catch (e: any) { toast(e.message) }
  }

  const listening = speech.state === 'listening'
  const refining = speech.state === 'refining'
  return (
    <div className="chat">
      <div className="spread chat-top">
        <button className="linkbtn small" onClick={onBack}><ArrowLeft />All sessions</button>
        {(sess.messages.length > 0 || sess.archived) && <button className="linkbtn small" onClick={onArchive}><Archive />{sess.archived ? 'Restore' : 'Archive'}</button>}
      </div>
      <div className="chat-scroll" ref={scroller}>
        {sess.messages.length === 0 && (
          <div className="chat-empty">
            <p className="small muted">Try one of these, or tap the mic and talk the way you would to an assistant.</p>
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {SUGGEST[scope.kind].map((s) => <button key={s} className="suggest-chip" disabled={busy} onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {sess.messages.map((m: any, mi: number) => {
          if (m.role === 'event') return <div key={m.id} className="chat-event tiny">{eventText(m)}</div>
          if (isAgentError(m)) {
            const said = [...sess.messages.slice(0, mi)].reverse().find((x: any) => x.role === 'rm')
            const last = mi === sess.messages.length - 1
            return (
              <div key={m.id} className="msg agent">
                <span className="orb sm" aria-hidden />
                <div className="agent-error" role="alert">
                  <p className="small"><span className="strong">The assistant couldn’t be reached just now.</span> Your message is saved{last ? '; try again in a moment' : ''}.</p>
                  {last && said?.text && <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => send(said.text)}><RotateCcw aria-hidden />Try again</button>}
                </div>
              </div>
            )
          }
          if (m.role === 'rm') return (
            <div key={m.id} className="msg rm">
              {m.bill?.thumb && <img src={m.bill.thumb} alt="Attached bill" className="bill-thumb" />}
              <div className="bubble">{m.text}</div>
              <div className="tiny faint">{m.via === 'voice' ? 'Spoken · ' : ''}{time(m.at.slice(0, 16))}</div>
            </div>
          )
          return (
            <div key={m.id} className="msg agent">
              <span className="orb sm" aria-hidden />
              <div className="grow" style={{ minWidth: 0 }}>
                {m.text && <div className="agent-text">{md(m.text)}</div>}
                {m.cards?.map((c: any) => <Card key={c.id} card={c} names={names} onDecide={decide} onBill={addBill} />)}
                {m.reads?.length > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>Looked at {listWords([...new Set<string>(m.reads.map((r: string) => READ_WORDS[r] || r.replace(/_/g, ' ')))])}</div>}
              </div>
            </div>
          )
        })}
        {busy && <div className="msg agent"><span className="orb sm on" aria-hidden /><div><div className="typing" aria-hidden><i /><i /><i /></div><div className="tiny muted" role="status" aria-live="polite">{waitText}</div></div></div>}
        <div ref={end} />
      </div>

      <div className="composer">
        {speech.error && <div className="composer-note loss">{speech.error} <button className="linkbtn" onClick={speech.clearError}>Dismiss</button></div>}
        {bill && (
          <div className="bill-chip">
            <img src={bill.thumb} alt="" />
            <div className="grow small">
              <div className="strong">{bill.fields.merchant || 'Bill'} · {bill.fields.amount ? inr(bill.fields.amount, { compact: false }) : 'amount unclear'}</div>
              <div className="tiny muted">{bill.fields.bill_date ? date(bill.fields.bill_date) : 'date unclear'} · {bill.fields.category || 'category unclear'}{bill.fields.gst ? ` · GSTIN ${bill.fields.gst}` : ''}</div>
            </div>
            <button className="iconbtn" aria-label="Remove bill" onClick={() => setBill(null)}><X /></button>
          </div>
        )}
        {listening || refining ? (
          <div className="listening">
            <div className="wave" aria-hidden>{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ transform: `scaleY(${0.15 + speech.level * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + Date.now() / 180)))})` }} />)}</div>
            <div className="live-text">{refining ? <span className="muted">Polishing the transcript…</span> : speech.live || <span className="muted">{speech.liveSupported && !speech.liveFailed ? 'Listening… speak naturally' : 'Listening… live text isn’t available here, so your words appear when you stop'}</span>}</div>
          </div>
        ) : (
          <textarea ref={ta} className="composer-input" rows={2} value={text} placeholder={`Ask or instruct the ${scope.kind} agent`}
            onChange={(e) => { setText(e.target.value); if (!e.target.value) setVia('text') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        )}
        <div className="composer-bar">
          <div className="row" style={{ gap: 4 }}>
            {allowBill && (
              <>
                <button className="iconbtn" title="Attach a bill for reimbursement" aria-label="Attach bill" onClick={() => file.current?.click()} disabled={billBusy}>{billBusy ? <Loader2 className="spin" /> : <Paperclip />}</button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0])} />
              </>
            )}
            {via === 'voice' && text && <span className="tiny muted"><Pencil size={11} /> Transcript: edit before sending</span>}
            {billBusy && <span className="tiny muted">Reading the bill…</span>}
            {!billBusy && !(via === 'voice' && text) && sess.messages.length === 0 && <span className="tiny muted">Enter sends · Shift+Enter for a new line</span>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className={`mic ${listening ? 'on' : ''}`} onClick={listening ? speech.stop : speech.start} disabled={refining || busy} aria-label={listening ? 'Stop listening' : 'Start speaking'} title={listening ? 'Tap to stop' : 'Tap to speak'}>
              {listening ? <Square size={14} fill="currentColor" /> : refining ? <Loader2 className="spin" size={18} /> : <Mic size={18} />}
            </button>
            <button className="btn btn-primary send" onClick={() => send()} disabled={busy || listening || refining || (!text.trim() && !bill)} aria-label="Send"><ArrowUp /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ card, onDecide, onBill, names }: { card: any; onDecide: (c: any, d: 'approve' | 'reject', args?: any, reason?: string) => void; onBill: (c: any, f: File) => Promise<void>; names: Record<string, string> }) {
  const [billBusy, setBillBusy] = useState(false)
  const claim = card.action === 'reimbursement'
  const billNeeded = claim && (card.checks || []).some((c: any) => c.id === 'bill' && !c.ok)
  const blocked = claim && card.blocking === true
  const meta = ACTION_META[card.action] || { icon: Check, label: card.action }
  const [edit, setEdit] = useState(false)
  const [args, setArgs] = useState<any>(card.args)
  const [working, setWorking] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const pending = card.status === 'pending'
  const go = async (d: 'approve' | 'reject') => { setWorking(true); await onDecide(card, d, d === 'approve' ? args : undefined, d === 'reject' ? reason.trim() : undefined); setWorking(false) }
  const fields = Object.entries(args).filter(([k, v]) => !HIDE.has(k) && !(Array.isArray(v) && v.length === 0 && !edit) && !(v === '' && !edit)).sort((a, b) => rank(a[0]) - rank(b[0]))
  const show = (k: string, v: any) => {
    if (v === null || v === undefined || v === '') return '—'
    if (k === 'start') return when(String(v))
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return date(v, true)
    if (k === 'amount' || k === 'estimated_investable') return inr(Number(v), { compact: false })
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? x.name : x)).join(', ') || '—'
    if (typeof v === 'string' && names[v]) return names[v]
    if (typeof v === 'string' && ['priority', 'channel', 'category', 'type'].includes(k) && /^[a-z_ ]+$/.test(v)) return label(v)
    return String(v)
  }
  return (
    <div className={`acard ${card.status}`}>
      <div className="acard-head">
        <span className="acard-icon"><meta.icon size={15} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tiny muted">{meta.label}</div>
          <div className="strong small">{card.summary}</div>
        </div>
        {!pending && <Status s={card.status}>{card.status === 'approved' ? (card.edited ? 'Approved with edits' : 'Approved') : 'Rejected, nothing sent'}</Status>}
      </div>
      {claim && pending && (
        <BillSlot bill={card.bill} required={billNeeded} busy={billBusy}
          onFile={async (f) => { setBillBusy(true); await onBill(card, f); setBillBusy(false) }} />
      )}
      {claim && !pending && card.bill?.thumb && <div className="bill-slot has"><img src={card.bill.thumb} alt="Attached bill" /><div className="small strong">Bill attached</div></div>}
      <dl className="acard-fields">
        {fields.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{FIELD_LABEL[k] || k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}</dt>
            <dd>
              {edit && pending ? (
                LONG.has(k) ? <textarea className="textarea" rows={k === 'body' || k === 'summary' ? 6 : 3} value={String(v ?? '')} onChange={(e) => setArgs({ ...args, [k]: e.target.value })} />
                  : k === 'start' ? <span className="col" style={{ gap: 3 }}><input className="input sm" type="datetime-local" aria-label="When" value={String(v).slice(0, 16)} onChange={(e) => setArgs({ ...args, start: e.target.value })} /><span className="tiny muted">{when(String(v))}</span></span>
                  : typeof v === 'boolean' ? <input type="checkbox" checked={v} onChange={(e) => setArgs({ ...args, [k]: e.target.checked })} />
                  : typeof v === 'number' ? <input className="input sm" type="number" value={v} onChange={(e) => setArgs({ ...args, [k]: Number(e.target.value) })} />
                  : Array.isArray(v) ? <textarea className="textarea" rows={3} value={v.map((x) => (typeof x === 'object' ? x.name : x)).join('\n')} onChange={(e) => setArgs({ ...args, [k]: e.target.value.split('\n').filter(Boolean).map((x) => (typeof v[0] === 'object' ? { name: x } : x)) })} />
                  : k.endsWith('_id') ? <span className="muted">{show(k, v)}</span>
                  : <input className="input sm" value={String(v ?? '')} onChange={(e) => setArgs({ ...args, [k]: e.target.value })} />
              ) : (
                <span className={LONG.has(k) ? 'pre' : ''}>{show(k, v)}</span>
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
      {claim && pending && <Checks checks={card.checks} />}
      {pending && rejecting ? (
        <div className="acard-actions acard-reject">
          <input className="input sm grow" autoFocus placeholder="What was wrong? (optional)" aria-label="Why you are rejecting this card (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go('reject'); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRejecting(false) } }} />
          <button className="btn btn-quiet btn-sm" disabled={working} onClick={() => go('reject')}><X aria-hidden />Reject card</button>
          <button className="btn btn-ghost btn-sm" disabled={working} onClick={() => setRejecting(false)}>Keep it</button>
        </div>
      ) : pending ? (
        <div className="acard-actions">
          <button className="btn btn-primary btn-sm" disabled={working || blocked} onClick={() => go('approve')}><Check />{edit ? 'Approve edited' : 'Approve'}</button>
          <button className="btn btn-quiet btn-sm" disabled={working} onClick={() => setEdit((e) => !e)}><Pencil />{edit ? 'Stop editing' : 'Edit'}</button>
          <button className="btn btn-ghost btn-sm" disabled={working} onClick={() => setRejecting(true)}><X />Reject</button>
          {blocked && <span className="acard-blocked">{billNeeded ? 'Add the bill to approve' : 'Fix the checks above to approve'}</span>}
        </div>
      ) : card.status === 'rejected' ? (
        card.reason ? <div className="acard-result tiny muted">Your reason: {card.reason}</div> : null
      ) : card.status === 'approved' && (
        <div className="acard-result tiny">
          {card.result?.outbox && <Link to={`/requests?tab=outbox&o=${card.result.outbox}`} className="linkbtn"><Mail />Outbox {card.result.outbox}</Link>}
          {card.result?.request && <Link to={`/requests?r=${card.result.request}`} className="linkbtn"><HandCoins />Request {card.result.request}</Link>}
          {card.result?.meeting && <Link to={`/meetings?m=${card.result.meeting}`} className="linkbtn"><CalendarPlus />Meeting {card.result.meeting}</Link>}
          {card.result?.warning && <span className="muted">{card.result.warning}</span>}
        </div>
      )}
    </div>
  )
}
