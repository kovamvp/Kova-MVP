import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, ShieldCheck, X } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { date } from '../lib/format'
import { Panel, useToast } from '../ui'

/* Structured needs and consent for prospects; same lists as backend/prospects.py */
export const GOALS = ['Grow wealth', 'Regular income', 'Preserve capital', 'Plan for a goal', 'Invest a windfall', 'Save tax', 'Retirement', 'Not sure yet']
export const HORIZONS = ['Under 1 year', '1–3 years', '3–5 years', '5+ years']
export const CLASSES = ['Equity', 'Debt', 'Gold', 'Cash']
export const PROSPECT_CONSENT = [{ key: 'whatsapp', label: 'WhatsApp' }, { key: 'email', label: 'Email' }, { key: 'marketing', label: 'Marketing' }]

export type Needs = { goal: string; horizon: string | null; asset_classes: string[] }

export function NeedsFields({ v, onChange }: { v: Needs; onChange: (n: Needs) => void }) {
  return (
    <>
      <label className="field"><span>Main goal</span>
        <select className="select" value={v.goal} onChange={(e) => onChange({ ...v, goal: e.target.value })}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
      </label>
      <label className="field"><span>Horizon</span>
        <select className="select" value={v.horizon || ''} onChange={(e) => onChange({ ...v, horizon: e.target.value || null })}>
          <option value="">Not discussed</option>{HORIZONS.map((h) => <option key={h}>{h}</option>)}
        </select>
      </label>
      <fieldset className="field chips-field" style={{ gridColumn: '1 / -1' }}>
        <legend>Interested in</legend>
        <div className="row wrap" style={{ gap: 6 }}>
          {CLASSES.map((c) => {
            const on = v.asset_classes.includes(c)
            return <button type="button" key={c} className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => onChange({ ...v, asset_classes: on ? v.asset_classes.filter((x) => x !== c) : [...v.asset_classes, c] })}>{c}</button>
          })}
        </div>
      </fieldset>
    </>
  )
}

export function ConsentFields({ v, onChange }: { v: Record<string, boolean>; onChange: (c: Record<string, boolean>) => void }) {
  return (
    <fieldset className="field" style={{ gridColumn: '1 / -1' }}>
      <legend>They agreed to hear from Kova by</legend>
      <div className="row wrap" style={{ gap: 14 }}>
        {PROSPECT_CONSENT.map((k) => (
          <label key={k.key} className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!!v[k.key]} onChange={(e) => onChange({ ...v, [k.key]: e.target.checked })} />{k.label}</label>
        ))}
      </div>
    </fieldset>
  )
}

/* Live warning while the RM types a mobile, email or PAN */
export function DuplicateWarning({ phone, email, exclude }: { phone?: string; email?: string; exclude?: string }) {
  const [hits, setHits] = useState<any[]>([])
  useEffect(() => {
    const digits = (phone || '').replace(/\D/g, '')
    if (digits.length < 10 && !(email || '').includes('@')) { setHits([]); return }
    const t = window.setTimeout(() => {
      api('/prospects/check', { body: { phone, email, exclude } }).then((r) => setHits(r.matches || [])).catch(() => setHits([]))
    }, 300)
    return () => window.clearTimeout(t)
  }, [phone, email, exclude])
  if (!hits.length) return null
  const h = hits[0]
  return (
    <div className={`sev ${h.kind === 'other_rm' ? 'medium' : 'high'} small dup-warning`} role="status" style={{ gridColumn: '1 / -1' }}>
      {h.kind === 'other_rm'
        ? <>This {h.matched_on} is already on {h.rm}’s book ({h.branch}). You can still add them; your branch head decides who keeps the relationship.</>
        : <>{h.name} is already your {h.kind} ({h.id}), matched on {h.matched_on}. <Link to={`/${h.kind === 'client' ? 'clients' : 'prospects'}/${h.id}`}>Open that record</Link> instead.</>}
    </div>
  )
}

export function NeedsPanel({ p }: { p: any }) {
  const [edit, setEdit] = useState(false)
  const [n, setN] = useState<Needs>(p.needs || { goal: 'Not sure yet', horizon: null, asset_classes: [] })
  const [c, setC] = useState<Record<string, boolean>>(p.consent || {})
  const { busy, run } = useAction()
  const toast = useToast()
  const { data: req } = useApi<any>(p.ownership?.request_id ? `/c/requests/${p.ownership.request_id}` : null)
  const save = () => run(async () => {
    await api('/actions/update_prospect', { body: { prospect_id: p.id, needs: n, consent: Object.fromEntries(PROSPECT_CONSENT.map((k) => [k.key, !!c[k.key]])) } })
    invalidate('/c/prospects')
    setEdit(false)
    toast('Needs and consent saved. The change is on the timeline.')
  }, 'The changes weren’t saved')
  const verified = p.contact_verified || {}
  return (
    <Panel title="Needs and consent" aside={!edit && !p.converted && <button className="iconbtn sm" aria-label="Edit needs and consent" title="Edit" onClick={() => { setN(p.needs || n); setC(p.consent || {}); setEdit(true) }}><Pencil size={13} /></button>}>
      {p.ownership && (
        <div className={`sev ${req?.status === 'done' ? 'low' : 'medium'} small`} style={{ marginBottom: 12 }}>
          {req?.status === 'done' ? <>Ownership settled by your branch head: the relationship stays with you.</>
            : <>Also on {p.ownership.with_rm}’s book (matched on {p.ownership.matched_on}). Your branch head is deciding who keeps the relationship.</>}
        </div>
      )}
      {edit ? (
        <div className="grid g2" style={{ gap: 10 }}>
          <NeedsFields v={n} onChange={setN} />
          <ConsentFields v={c} onChange={setC} />
          <div className="row" style={{ gridColumn: '1 / -1' }}><button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save needs and consent</button><button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Cancel</button></div>
        </div>
      ) : (
        <>
          <dl className="pf-kv">
            <div className="pf-row"><dt>Main goal</dt><dd>{p.needs?.goal || 'Not recorded'}</dd></div>
            <div className="pf-row"><dt>Horizon</dt><dd>{p.needs?.horizon || <span className="muted">Not discussed</span>}</dd></div>
            <div className="pf-row"><dt>Interested in</dt><dd>{p.needs?.asset_classes?.length ? p.needs.asset_classes.join(', ') : <span className="muted">Not discussed</span>}</dd></div>
            <div className="pf-row"><dt>Mobile</dt><dd>{p.phone || <span className="muted">Not given</span>} {p.phone && <span className={`pill ${verified.mobile ? 'gain' : 'outline'}`}>{verified.mobile ? 'Verified' : 'Unverified'}</span>}</dd></div>
            <div className="pf-row"><dt>Email</dt><dd className="ellipsis">{p.email || <span className="muted">Not given</span>} {p.email && <span className={`pill ${verified.email ? 'gain' : 'outline'}`}>{verified.email ? 'Verified' : 'Unverified'}</span>}</dd></div>
          </dl>
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            <span className="small strong row" style={{ gap: 6 }}><ShieldCheck size={14} color="var(--forest)" />Consent</span>
            {PROSPECT_CONSENT.map((k) => <span key={k.key} className={`consent ${p.consent?.[k.key] ? 'yes' : 'no'}`}>{p.consent?.[k.key] ? <Check size={12} /> : <X size={12} />}{k.label}</span>)}
            {p.consent?.captured_on && <span className="tiny muted">recorded {date(p.consent.captured_on, true)}</span>}
          </div>
        </>
      )}
    </Panel>
  )
}
