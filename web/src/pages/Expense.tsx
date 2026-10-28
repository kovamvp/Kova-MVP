import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CircleDot, Info, Loader2, Receipt, X } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { useAction } from '../lib/action'
import { date, inr, todayISO } from '../lib/format'
import { resizeImage } from '../shell/ProfileMenu'
import { AmountInput, useToast } from '../ui'

/* Reimbursements: the bill slot, the policy checks and the manual claim form.
   The same pieces appear on the agent's reimbursement card, so the RM sees one set of rules everywhere. */

export const CATEGORIES = ['Client meeting meals', 'Local travel', 'Outstation travel', 'Client gifts', 'Events', 'Phone and internet']
export const CLIENT_COSTS = new Set(['Client meeting meals', 'Client gifts', 'Events'])

export type Bill = { thumb: string; fields: Record<string, any> }
export type CheckRow = { id: string; ok: boolean; level: 'block' | 'approval' | 'info'; text: string }

/* Resize in the browser, then let the bill reader fill what it can. A failed read still keeps the image. */
export async function readBill(f: File): Promise<{ bill: Bill; note?: string }> {
  const image = await resizeImage(f, 1400, 0.85)
  const thumb = await resizeImage(f, 480, 0.7)
  try {
    const r = await api('/agent/read-bill', { body: { image } })
    const fields = r.fields || {}
    return { bill: { thumb, fields }, note: fields.confidence === 'low' ? 'The bill was hard to read. Check the amount and date.' : undefined }
  } catch {
    return { bill: { thumb, fields: {} }, note: 'Couldn’t read the bill, so fill in the details yourself. The image is attached.' }
  }
}

export function BillSlot({ bill, required, busy, onFile, onRemove }: { bill?: Bill | null; required: boolean; busy?: boolean; onFile: (f: File) => void; onRemove?: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  const pick = () => file.current?.click()
  return (
    <div className={`bill-slot ${bill ? 'has' : required ? 'needed' : ''}`}>
      <input ref={file} type="file" accept="image/*" hidden aria-hidden tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      {bill ? (
        <>
          <img src={bill.thumb} alt="Attached bill" />
          <div className="grow small">
            <div className="strong">Bill attached</div>
            <div className="tiny muted">
              {[bill.fields.merchant, bill.fields.amount ? inr(bill.fields.amount, { compact: false }) : null, bill.fields.bill_date ? date(bill.fields.bill_date) : null].filter(Boolean).join(' · ') || 'Details as entered below'}
            </div>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={pick}>{busy ? <Loader2 className="spin" aria-hidden /> : null}Replace</button>
          {onRemove && <button type="button" className="iconbtn" aria-label="Remove the bill" disabled={busy} onClick={onRemove}><X /></button>}
        </>
      ) : (
        <>
          <span className="bill-slot-icon" aria-hidden><Receipt size={18} /></span>
          <div className="grow small">
            <div className="strong">{required ? 'Attach the bill' : 'Bill (optional)'}</div>
            <div className="tiny muted">{busy ? 'Reading the bill…' : required ? 'Required for this amount. A photo is fine; the details are read for you.' : 'Not needed at this amount, but it helps Accounts.'}</div>
          </div>
          <button type="button" className={`btn btn-sm ${required ? 'btn-primary' : 'btn-quiet'}`} disabled={busy} onClick={pick}>
            {busy ? <Loader2 className="spin" aria-hidden /> : <Receipt aria-hidden />}Add bill
          </button>
        </>
      )}
    </div>
  )
}

const ICON = { ok: Check, block: AlertCircle, approval: CircleDot, info: Info }
const SR = { ok: 'Passed: ', block: 'Fix before sending: ', approval: 'Needs branch head: ', info: 'Advice: ' }
/* What needs attention first, plus what's left of the month; the passes fold into one line */
export function Checks({ checks }: { checks: CheckRow[] }) {
  const [all, setAll] = useState(false)
  if (!checks?.length) return null
  const order = { block: 0, approval: 1, info: 2 }
  const flagged = checks.filter((c) => !c.ok).sort((a, b) => order[a.level] - order[b.level])
  const always = checks.filter((c) => c.ok && c.id === 'monthly_cap')
  const passed = checks.filter((c) => c.ok && c.id !== 'monthly_cap')
  const row = (c: CheckRow) => {
    const kind = c.ok ? 'ok' : c.level
    const I = ICON[kind]
    return <li key={c.id} className={`cc ${kind}`}><I size={14} aria-hidden /><span><span className="sr-only">{SR[kind]}</span>{c.text}</span></li>
  }
  return (
    <ul className="claim-checks" aria-label="Policy checks">
      {flagged.map(row)}
      {always.map(row)}
      {all ? passed.map(row) : passed.length > 0 && (
        <li className="cc ok"><Check size={14} aria-hidden /><span>{flagged.length ? `The other ${passed.length} checks pass.` : `All ${passed.length} other checks pass.`} <button type="button" className="linkbtn" onClick={() => setAll(true)}>Show them</button></span></li>
      )}
    </ul>
  )
}

/* Manual claim, from the Actions panel. Checks run as the RM types; nothing goes out until "Send claim". */
export function ReimbursementForm({ clientId, clientName, onDone }: { clientId?: string; clientName?: string; onDone: () => void }) {
  const [f, setF] = useState({ category: 'Client meeting meals', amount: 0, merchant: '', bill_date: todayISO(), gst: '', purpose: '' })
  const [bill, setBill] = useState<Bill | null>(null)
  const [reading, setReading] = useState(false)
  const [check, setCheck] = useState<any>(null)
  const touched = useRef(false)
  const { busy, run } = useAction()
  const toast = useToast()
  const linked = CLIENT_COSTS.has(f.category) || f.category === 'Local travel' || f.category === 'Outstation travel'
  const args = { ...f, client_id: linked && clientId ? clientId : undefined }

  useEffect(() => {
    const t = window.setTimeout(() => {
      api('/expenses/check', { body: { ...args, has_bill: !!bill, bill_amount: bill?.fields.amount } }).then(setCheck).catch(() => setCheck(null))
    }, 250)
    return () => window.clearTimeout(t)
  }, [f.category, f.amount, f.merchant, f.bill_date, f.gst, bill, clientId])

  const onFile = async (file: File) => {
    setReading(true)
    const { bill: b, note } = await readBill(file)
    setBill(b)
    const x = b.fields
    /* the bill fills what's still empty; a different amount you typed stays, and the checks point out the difference */
    setF((cur) => ({
      ...cur,
      amount: cur.amount || (x.amount ? Number(x.amount) : 0),
      merchant: cur.merchant || x.merchant || '',
      bill_date: x.bill_date && cur.bill_date === todayISO() ? x.bill_date : cur.bill_date,
      gst: cur.gst || x.gst || '',
      category: !touched.current && x.category && CATEGORIES.includes(x.category) ? x.category : cur.category,
    }))
    if (note) toast(note)
    setReading(false)
  }

  const save = () => run(async () => {
    const r = await api('/actions/reimbursement', { body: { ...args, bill_image: bill?.thumb } })
    invalidate('/c/')
    toast(r.request?.payload?.needs_manager ? 'Claim sent. It goes to your branch head first, then Accounts. Track it in Requests.' : 'Claim sent to Accounts. Track it in Requests.')
    onDone()
  }, 'The claim wasn’t sent')

  const bad = (id: string) => check?.checks?.find((c: CheckRow) => c.id === id && !c.ok)
  const billRequired = !!bad('bill')
  return (
    <div className="action-form">
      <BillSlot bill={bill} required={billRequired} busy={reading} onFile={onFile} onRemove={() => setBill(null)} />
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field"><span>Category</span>
          <select className="select" value={f.category} onChange={(e) => { touched.current = true; setF({ ...f, category: e.target.value }) }}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field"><span>Amount</span><AmountInput label="Amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></label>
        <label className="field"><span>Where</span><input className="input" value={f.merchant} placeholder="Restaurant, cab, shop" onChange={(e) => setF({ ...f, merchant: e.target.value })} /></label>
        <label className="field"><span>Bill date</span><input className="input" type="date" max={todayISO()} value={f.bill_date} onChange={(e) => setF({ ...f, bill_date: e.target.value })} /></label>
      </div>
      <label className="field"><span>GSTIN on the bill, if any</span><input className="input" value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value.toUpperCase() })} /></label>
      <label className="field"><span>What it was for</span><input className="input" value={f.purpose} placeholder={clientName ? `Lunch with ${clientName} after the review` : 'Purpose'} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></label>
      {linked && clientName && <p className="tiny muted">Linked to {clientName}.</p>}
      {check && <Checks checks={check.checks} />}
      <div className="row">
        <button className="btn btn-primary" disabled={busy || reading || !check || check.blocking} onClick={save}>{check?.needs_manager ? 'Send to branch head' : 'Send claim'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
