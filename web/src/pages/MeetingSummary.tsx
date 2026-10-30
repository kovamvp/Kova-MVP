import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, NotebookPen, Pencil, Plus, Receipt, Send, Trash2, Wallet } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { SERVICE_CATEGORIES, useProducts } from '../lib/data'
import { nowISO, when } from '../lib/format'
import { Modal, useToast } from '../ui'

/* After a meeting: the summary (up to six sections), where each part was filed, and the MoM drafted from it.
   Same lists as backend/summaries.py. */
const OUTCOMES = ['Positive', 'Neutral', 'Needs follow-up', 'Proposal requested', 'Transaction agreed', 'Not interested']
const INTEREST = ['Interested', 'Follow up', 'Not interested']
const REGULATORY = ['Risk profile review', 'KYC update', 'Nominee', 'Consent', 'FATCA', 'Other']
const SECTIONS = [
  { key: 'portfolio', label: 'Portfolio' }, { key: 'products', label: 'Products' }, { key: 'service', label: 'Service' },
  { key: 'engagement', label: 'Engagement' }, { key: 'regulatory', label: 'Regulatory' }, { key: 'to_get', label: 'To get from the client' },
] as const
const KIND_WORDS: Record<string, string> = {
  pipeline: 'Pipeline', product_feedback: 'Product team', service_request: 'Service request', owed: 'To get', task: 'Your task',
  follow_up: 'Follow-up meeting', follow_up_prompt: 'Reminder', profile: 'Profile',
}
const entityHref = (m: any) => `/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}`

export function SummarySection({ m, P }: { m: any; P: Record<string, any> }) {
  const [editing, setEditing] = useState(false)
  const [mom, setMom] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  if (m.status === 'cancelled' || m.start > nowISO()) return null
  const s = m.summary
  const routed = Object.values(m.routed || {}) as any[]
  const agent = <Link className="btn btn-quiet btn-sm" to={`${entityHref(m)}?panel=agent&summary=${m.id}`}><Mic />Tell the agent</Link>
  return (
    <div className="summary-block">
      <div className="spread"><h3>Summary</h3>{s && <span className="pill forest">{s.outcome}</span>}</div>
      {!s ? (
        <>
          <p className="small muted" style={{ margin: '4px 0 10px' }}>How did it go? Say it to the agent or write it here. Each part is filed where it belongs, and the MoM is drafted from it.</p>
          <div className="row wrap" style={{ gap: 8 }}>{agent}<button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}><NotebookPen />Write the summary</button></div>
        </>
      ) : (
        <>
          <dl className="kv small" style={{ gridTemplateColumns: '120px 1fr', marginTop: 8 }}>
            {s.portfolio?.discussed && <><dt>Portfolio</dt><dd>{s.portfolio.discussed}{s.portfolio.changes?.length ? <><br /><span className="muted">Agreed: {s.portfolio.changes.join('; ')}</span></> : null}</dd></>}
            {s.products?.length > 0 && <><dt>Products</dt><dd>{s.products.map((p: any) => `${P[p.product_id]?.name || p.product_id} (${p.interest.toLowerCase()})`).join(', ')}</dd></>}
            {s.service?.length > 0 && <><dt>Service</dt><dd>{s.service.map((x: any) => x.category).join(', ')}</dd></>}
            {s.engagement?.notes && <><dt>Engagement</dt><dd>{s.engagement.notes}</dd></>}
            {s.regulatory?.length > 0 && <><dt>Regulatory</dt><dd>{s.regulatory.map((x: any) => x.kind).join(', ')}</dd></>}
            {s.to_get?.length > 0 && <><dt>To get</dt><dd>{s.to_get.map((x: any) => x.text).join('; ')}</dd></>}
          </dl>
          {routed.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny muted" style={{ marginBottom: 4 }}>Filed from this summary</div>
              <ul className="routed">
                {routed.map((r: any) => (
                  <li key={r.ref} className={r.status === 'closed' || r.status === 'cancelled' ? 'gone' : ''}>
                    <span className="pill outline">{KIND_WORDS[r.kind] || r.kind}</span> {r.label}
                    {r.kind === 'follow_up' && <Link className="linkbtn tiny" to={`/meetings?m=${r.ref}`} style={{ marginLeft: 6 }}>Open</Link>}
                    {(r.status === 'closed' || r.status === 'cancelled') && <span className="tiny muted"> · removed in an edit</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="tiny muted" style={{ marginTop: 6 }}>Version {s.version} · {s.by === 'agent' ? 'from the agent' : 'by you'} · {when(s.at)}</p>
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-quiet btn-sm" onClick={() => setEditing(true)}><Pencil />Edit summary</button>
            {agent}
            {!m.mom && <button className="btn btn-primary btn-sm" onClick={() => setMom(true)}><Send />Draft the MoM</button>}
          </div>
          {justSaved && m.with.kind === 'client' && (
            <div className="next-steps">
              <span className="small strong">Anything else from this meeting?</span>
              <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
                <Link className="btn btn-quiet btn-sm" to={`${entityHref(m)}?panel=actions&do=reimb`}><Receipt />File a reimbursement</Link>
                <Link className="btn btn-quiet btn-sm" to={`/studio?new=1&tag=client:${m.with.id}`}><Wallet />Start a transaction in Studio</Link>
              </div>
            </div>
          )}
        </>
      )}
      {editing && <SummaryForm m={m} P={P} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setJustSaved(true) }} />}
      {mom && <MomEditor m={m} onClose={() => setMom(false)} />}
    </div>
  )
}

type Draft = {
  on: Record<string, boolean>
  portfolio: { discussed: string; reaction: string; changes: string }
  products: { product_id: string; interest: string; amount: number | null; feedback: string }[]
  service: { category: string; details: string }[]
  engagement: string
  regulatory: { kind: string; note: string }[]
  to_get: { text: string; due: string }[]
  outcome: string
  next: { start: string; title: string }
}

function initial(m: any): Draft {
  const s = m.summary
  const plan = m.plan || {}
  return {
    on: Object.fromEntries(SECTIONS.map((x) => [x.key, s ? !!(Array.isArray(s[x.key]) ? s[x.key].length : x.key === 'engagement' ? s.engagement?.notes : s[x.key]) : (x.key === 'portfolio' ? !!plan.portfolio : x.key === 'products' ? !!plan.products?.length : x.key === 'service' ? !!plan.service?.length : false)])),
    portfolio: { discussed: s?.portfolio?.discussed || '', reaction: s?.portfolio?.reaction || '', changes: (s?.portfolio?.changes || []).join('\n') },
    products: s?.products?.map((p: any) => ({ ...p, feedback: p.feedback || '' })) || (plan.products || []).map((id: string) => ({ product_id: id, interest: 'Interested', amount: null, feedback: '' })),
    service: s?.service || (plan.service || []).map((c: string) => ({ category: c, details: '' })),
    engagement: s?.engagement?.notes || '',
    regulatory: s?.regulatory || [],
    to_get: (s?.to_get || []).map((t: any) => ({ text: t.text, due: t.due || '' })),
    outcome: s?.outcome || 'Positive',
    next: { start: s?.next_meeting?.start || '', title: s?.next_meeting?.title || '' },
  }
}

function SummaryForm({ m, P, onClose, onSaved }: { m: any; P: Record<string, any>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(() => initial(m))
  const [wantNext, setWantNext] = useState(!!m.summary?.next_meeting)
  const { data: products = [] } = useProducts()
  const { busy, run } = useAction()
  const toast = useToast()
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch })
  const save = () => run(async () => {
    const on = d.on
    const body: any = { meeting_id: m.id, outcome: d.outcome }
    if (on.portfolio) body.portfolio = { discussed: d.portfolio.discussed, reaction: d.portfolio.reaction, changes: d.portfolio.changes.split('\n').map((x) => x.trim()).filter(Boolean) }
    if (on.products) body.products = d.products.filter((p) => p.product_id).map((p) => ({ ...p, amount: p.amount || undefined }))
    if (on.service) body.service = d.service
    if (on.engagement) body.engagement = { notes: d.engagement }
    if (on.regulatory) body.regulatory = d.regulatory
    if (on.to_get) body.to_get = d.to_get.filter((t) => t.text.trim()).map((t) => ({ text: t.text, due: t.due || undefined }))
    if (wantNext) body.next_meeting = { start: d.next.start || undefined, title: d.next.title || undefined }
    const r = await api('/actions/record_summary', { body })
    invalidate('/c/'); invalidate('/meetings/'); invalidate('/clients/')
    toast(<>Summary saved. {r.routed.length ? `${r.routed.length} item${r.routed.length === 1 ? '' : 's'} filed.` : ''}{r.notes.length ? ` ${r.notes.join(' ')}` : ''}</>)
    onSaved()
  }, 'The summary wasn’t saved')
  const toggle = (k: string) => set({ on: { ...d.on, [k]: !d.on[k] } })
  return (
    <Modal wide title={`Summary: ${m.title}`} sub="Fill only what came up. Each part is filed where it belongs; the client sees only the MoM you send." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{m.summary ? 'Save changes' : 'Save summary'}</button></>}>
      <div className="col" style={{ gap: 14 }}>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Sections">
          {SECTIONS.map((x) => <button key={x.key} type="button" className={`chip ${d.on[x.key] ? 'on' : ''}`} aria-pressed={!!d.on[x.key]} onClick={() => toggle(x.key)}>{x.label}</button>)}
        </div>
        {d.on.portfolio && <fieldset className="sum-sec"><legend>Portfolio</legend>
          <label className="field"><span>What you discussed</span><textarea className="textarea" rows={2} value={d.portfolio.discussed} onChange={(e) => set({ portfolio: { ...d.portfolio, discussed: e.target.value } })} /></label>
          <label className="field"><span>How they reacted (internal)</span><input className="input" value={d.portfolio.reaction} onChange={(e) => set({ portfolio: { ...d.portfolio, reaction: e.target.value } })} /></label>
          <label className="field"><span>Changes agreed, one per line</span><textarea className="textarea" rows={2} value={d.portfolio.changes} onChange={(e) => set({ portfolio: { ...d.portfolio, changes: e.target.value } })} /></label>
        </fieldset>}
        {d.on.products && <fieldset className="sum-sec"><legend>Products</legend>
          {d.products.map((p, i) => (
            <div key={i} className="sum-row">
              <select className="select" aria-label="Product" value={p.product_id} onChange={(e) => set({ products: d.products.map((x, j) => j === i ? { ...x, product_id: e.target.value } : x) })}>
                <option value="">Choose a product…</option>{products.filter((x) => x.asset_class).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <select className="select" aria-label="Interest" value={p.interest} onChange={(e) => set({ products: d.products.map((x, j) => j === i ? { ...x, interest: e.target.value } : x) })}>{INTEREST.map((x) => <option key={x}>{x}</option>)}</select>
              <input className="input" aria-label="Feedback for the product team" placeholder="Feedback for the product team (optional)" value={p.feedback} onChange={(e) => set({ products: d.products.map((x, j) => j === i ? { ...x, feedback: e.target.value } : x) })} />
              <button type="button" className="iconbtn" aria-label={`Remove ${P[p.product_id]?.name || 'product'}`} onClick={() => set({ products: d.products.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="linkbtn small" onClick={() => set({ products: [...d.products, { product_id: '', interest: 'Interested', amount: null, feedback: '' }] })}><Plus size={14} />Add a product</button>
        </fieldset>}
        {d.on.service && <fieldset className="sum-sec"><legend>Service</legend>
          {d.service.map((sv, i) => (
            <div key={i} className="sum-row two">
              <select className="select" aria-label="Service item" value={sv.category} onChange={(e) => set({ service: d.service.map((x, j) => j === i ? { ...x, category: e.target.value } : x) })}>{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <input className="input" aria-label="Details" placeholder="Details for Client Experience" value={sv.details} onChange={(e) => set({ service: d.service.map((x, j) => j === i ? { ...x, details: e.target.value } : x) })} />
              <button type="button" className="iconbtn" aria-label="Remove service item" onClick={() => set({ service: d.service.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="linkbtn small" onClick={() => set({ service: [...d.service, { category: 'Demographic update', details: '' }] })}><Plus size={14} />Add a service item</button>
        </fieldset>}
        {d.on.engagement && <fieldset className="sum-sec"><legend>Engagement</legend>
          <label className="field"><span>Personal and relationship notes (internal; profile-enrichment consent applies)</span><textarea className="textarea" rows={2} value={d.engagement} onChange={(e) => set({ engagement: e.target.value })} /></label>
        </fieldset>}
        {d.on.regulatory && <fieldset className="sum-sec"><legend>Regulatory</legend>
          {d.regulatory.map((r, i) => (
            <div key={i} className="sum-row two">
              <select className="select" aria-label="Regulatory item" value={r.kind} onChange={(e) => set({ regulatory: d.regulatory.map((x, j) => j === i ? { ...x, kind: e.target.value } : x) })}>{REGULATORY.map((c) => <option key={c}>{c}</option>)}</select>
              <input className="input" aria-label="Note" placeholder="What needs doing" value={r.note} onChange={(e) => set({ regulatory: d.regulatory.map((x, j) => j === i ? { ...x, note: e.target.value } : x) })} />
              <button type="button" className="iconbtn" aria-label="Remove regulatory item" onClick={() => set({ regulatory: d.regulatory.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="linkbtn small" onClick={() => set({ regulatory: [...d.regulatory, { kind: 'Risk profile review', note: '' }] })}><Plus size={14} />Add a regulatory item</button>
        </fieldset>}
        {d.on.to_get && <fieldset className="sum-sec"><legend>To get from the client</legend>
          {d.to_get.map((t, i) => (
            <div key={i} className="sum-row two">
              <input className="input" aria-label="What they'll send" placeholder="Latest Kotak statement" value={t.text} onChange={(e) => set({ to_get: d.to_get.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
              <input className="input" type="date" aria-label="By" value={t.due} onChange={(e) => set({ to_get: d.to_get.map((x, j) => j === i ? { ...x, due: e.target.value } : x) })} />
              <button type="button" className="iconbtn" aria-label="Remove item" onClick={() => set({ to_get: d.to_get.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="linkbtn small" onClick={() => set({ to_get: [...d.to_get, { text: '', due: '' }] })}><Plus size={14} />Add an item</button>
        </fieldset>}
        <div className="grid g2" style={{ gap: 10 }}>
          <label className="field"><span>Outcome</span><select className="select" value={d.outcome} onChange={(e) => set({ outcome: e.target.value })}>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="row small" style={{ gap: 8, alignSelf: 'end', paddingBottom: 8 }}><input type="checkbox" checked={wantNext} onChange={(e) => setWantNext(e.target.checked)} />Agreed to meet again</label>
        </div>
        {wantNext && <div className="grid g2" style={{ gap: 10 }}>
          <label className="field"><span>When (leave empty if not fixed yet)</span><input className="input" type="datetime-local" value={d.next.start} onChange={(e) => set({ next: { ...d.next, start: e.target.value } })} /></label>
          <label className="field"><span>Follow-up title</span><input className="input" value={d.next.title} placeholder={`Follow-up: ${m.title}`} onChange={(e) => set({ next: { ...d.next, title: e.target.value } })} /></label>
          <p className="tiny muted" style={{ gridColumn: '1 / -1' }}>The follow-up carries the products, agreed changes and what’s still to get into its plan. With no time yet, you get a reminder to book it.</p>
        </div>}
      </div>
    </Modal>
  )
}

function MomEditor({ m, onClose }: { m: any; onClose: () => void }) {
  const { data: d } = useApi<any>(`/meetings/${m.id}/mom-draft`)
  const { data: who } = useApi<any>(`/c/${m.with.kind === 'client' ? 'clients' : 'prospects'}/${m.with.id}`)
  const [text, setText] = useState('')
  const [promises, setPromises] = useState('')
  const [channel, setChannel] = useState<'Email' | 'WhatsApp'>('Email')
  useEffect(() => { if (d) { setText(d.summary); setPromises(d.promises.join('\n')) } }, [d])
  const { busy, run } = useAction()
  const toast = useToast()
  const send = () => run(async () => {
    await api('/actions/log_mom', { body: { with_kind: m.with.kind, with_id: m.with.id, meeting_id: m.id, summary: text, promises: promises.split('\n').map((x) => x.trim()).filter(Boolean),
      portfolio_reaction: d?.portfolio_reaction, changes_asked: d?.changes_asked, channel, send_to_client: true } })
    invalidate('/c/')
    toast(`MoM sent to ${d?.first_name || 'the client'} by ${channel.toLowerCase()}. It’s in the outbox.`)
    onClose()
  }, 'The MoM wasn’t sent')
  return (
    <Modal title="Minutes for the client" sub="Drafted from your summary, with only what’s right for the client. Edit anything before sending." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !text.trim()} onClick={send}><Send />Send MoM</button></>}>
      {!d ? <p className="small muted">Drafting…</p> : (
        <div className="col" style={{ gap: 10 }}>
          <div className="seg" role="group" aria-label="Channel">
            <button className={channel === 'Email' ? 'on' : ''} aria-pressed={channel === 'Email'} onClick={() => setChannel('Email')}>Email</button>
            <button className={channel === 'WhatsApp' ? 'on' : ''} aria-pressed={channel === 'WhatsApp'} disabled={!who?.consent?.whatsapp} onClick={() => setChannel('WhatsApp')}>WhatsApp</button>
          </div>
          <label className="field"><span>To {d.to}</span><textarea className="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label className="field"><span>Your next steps, one per line (tracked as promises)</span><textarea className="textarea" rows={3} value={promises} onChange={(e) => setPromises(e.target.value)} /></label>
        </div>
      )}
    </Modal>
  )
}

/* For the prep pack: what's still open from the meeting this one follows */
export function FromLastTime({ m, meetings, P }: { m: any; meetings: any[]; P: Record<string, any> }) {
  const prev = m.previous_meeting_id ? meetings.find((x) => x.id === m.previous_meeting_id) : null
  if (!prev?.summary) return null
  const s = prev.summary
  const open = (s.products || []).filter((p: any) => p.interest !== 'Not interested').map((p: any) => P[p.product_id]?.name).filter(Boolean)
  return (
    <div className="prep-box">
      <div className="tiny muted">From last time ({prev.title})</div>
      <ul>
        {s.portfolio?.changes?.map((c: string) => <li key={c}>Agreed: {c}</li>)}
        {open.length > 0 && <li>Follow up on {open.join(', ')}</li>}
        {s.to_get?.map((t: any) => <li key={t.text}>Still to get: {t.text}</li>)}
      </ul>
    </div>
  )
}
