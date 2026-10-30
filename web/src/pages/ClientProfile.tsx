import { useState } from 'react'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { date } from '../lib/format'
import { Panel, useToast } from '../ui'

/* The client's profile in sections. Identity, KYC and anything tied to the account is locked and changes
   through a service request; every other section has its own edit button. Custom fields sit in their
   section; new ones come from the shared library or are made on the spot. */

type Field = { key: string; label: string; type: string; options?: string[] }
type Section = { key: string; label: string; locked?: boolean; consent?: string; fields: Field[] }
type Custom = { id: string; label: string; type: string; value: any; section: string; options?: string[]; added_by: string; at: string }

const show = (type: string, v: any) => {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null
  if (type === 'tags') return (v as string[]).join(', ')
  if (type === 'yes_no') return v ? 'Yes' : 'No'
  if (type === 'date') return date(v, true)
  return String(v)
}

function Input({ f, value, onChange }: { f: { label: string; type: string; options?: string[] }; value: any; onChange: (v: any) => void }) {
  if (f.type === 'choice') return (
    <select className="select" aria-label={f.label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Not recorded</option>{f.options?.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
  if (f.type === 'yes_no') return (
    <select className="select" aria-label={f.label} value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'yes')}>
      <option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option>
    </select>
  )
  if (f.type === 'tags') return <input className="input" aria-label={f.label} value={(value || []).join(', ')} placeholder="Separate with commas" onChange={(e) => onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
  return <input className="input" aria-label={f.label} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={(e) => onChange(f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />
}

export function ProfilePanel({ c, onRequest }: { c: any; onRequest: (category: string, what?: string) => void }) {
  const { data: lib } = useApi<any>('/profile/library')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [adding, setAdding] = useState(false)
  const { busy, run } = useAction()
  const toast = useToast()
  if (!lib) return <Panel title="Profile"><p className="small muted">Loading…</p></Panel>
  const sections: Section[] = lib.sections
  const custom: Custom[] = c.custom_fields || []
  const refresh = () => { invalidate('/c/'); invalidate('/clients/') }

  const startEdit = (s: Section) => {
    const cur = c.profile?.[s.key] || {}
    setDraft(Object.fromEntries([...s.fields.map((f) => [f.key, cur[f.key] ?? null]), ...custom.filter((x) => x.section === s.key).map((x) => [x.id, x.value])]))
    setEditing(s.key)
  }
  const save = (s: Section) => run(async () => {
    const cur = c.profile?.[s.key] || {}
    const changes = Object.fromEntries(s.fields.filter((f) => JSON.stringify(draft[f.key] ?? null) !== JSON.stringify(cur[f.key] ?? null)).map((f) => [f.key, draft[f.key]]))
    if (Object.keys(changes).length) await api('/actions/update_profile', { body: { client_id: c.id, section: s.key, changes } })
    for (const x of custom.filter((x) => x.section === s.key && JSON.stringify(draft[x.id] ?? null) !== JSON.stringify(x.value ?? null))) {
      await api('/actions/update_custom_field', { body: { client_id: c.id, field_id: x.id, value: draft[x.id] } })
    }
    refresh()
    setEditing(null)
    toast(`${s.label} saved. The change is on the timeline.`)
  }, 'The profile wasn’t saved')
  const remove = (x: Custom) => run(async () => {
    await api('/actions/remove_custom_field', { body: { client_id: c.id, field_id: x.id } })
    refresh()
    toast(`Removed “${x.label}”. The old value stays in the change log.`)
  }, 'The field wasn’t removed')

  const identity: [string, any, string][] = [
    ['Mobile', c.phone, 'Demographic update'], ['Email', c.email, 'Demographic update'], ['PAN', c.pan_masked, 'KYC re-verification'],
    ['Date of birth', c.dob ? date(c.dob, true) : null, 'KYC re-verification'], ['KYC', c.kyc ? `${c.kyc.status} · ${c.kyc.registration_agency}` : null, 'KYC re-verification'],
    ['Nominee', c.nominee, 'Nominee update'], ['Risk profile', `${c.risk_profile}${c.risk_profile_date ? ` · ${date(c.risk_profile_date, true)}` : ''}`, 'Other'],
  ]

  return (
    <Panel title="Profile" aside={<button className="linkbtn" onClick={() => setAdding(!adding)}><Plus size={14} />Add a field</button>}>
      {adding && <AddField c={c} sections={sections} library={lib.fields} onDone={() => { setAdding(false); refresh() }} />}
      <div className="profile-sections">
        {sections.map((s) => {
          const cur = c.profile?.[s.key] || {}
          const mine = custom.filter((x) => x.section === s.key)
          const noConsent = s.consent && !c.consent?.[s.consent]
          const open = editing === s.key
          if (s.locked) return (
            <section key={s.key} className="pf-sec" aria-label={s.label}>
              <div className="pf-head"><h3>{s.label}</h3><span className="tiny muted row" style={{ gap: 4 }}><Lock size={12} aria-hidden />Changes go through a service request</span></div>
              <dl className="pf-kv">
                {identity.map(([l, v, cat]) => (
                  <div key={l} className="pf-row locked">
                    <dt>{l}</dt><dd>{v ?? <span className="muted">Not recorded</span>}</dd>
                    <button className="iconbtn sm" aria-label={`Request a change to ${l.toLowerCase()}`} title="Request a change" onClick={() => onRequest(cat, `Change ${l.toLowerCase()}`)}><Lock size={13} /></button>
                  </div>
                ))}
              </dl>
            </section>
          )
          const filled = s.fields.filter((f) => show(f.type, cur[f.key]) !== null)
          return (
            <section key={s.key} className={`pf-sec ${open ? 'editing' : ''}`} aria-label={s.label}>
              <div className="pf-head">
                <h3>{s.label}</h3>
                {noConsent ? <span className="tiny muted">Needs profile-enrichment consent</span>
                  : !open && <button className="iconbtn sm" aria-label={`Edit ${s.label.toLowerCase()}`} title="Edit" onClick={() => startEdit(s)}><Pencil size={13} /></button>}
              </div>
              {noConsent ? null : open ? (
                <div className="pf-form">
                  {s.fields.map((f) => <label key={f.key} className="field"><span>{f.label}</span><Input f={f} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} /></label>)}
                  {mine.map((x) => (
                    <label key={x.id} className="field"><span className="spread">{x.label}<button type="button" className="linkbtn tiny" onClick={() => remove(x)}><Trash2 size={12} />Remove</button></span>
                      <Input f={x} value={draft[x.id]} onChange={(v) => setDraft({ ...draft, [x.id]: v })} /></label>
                  ))}
                  <div className="row"><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(s)}>Save {s.label.toLowerCase()}</button><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
                </div>
              ) : (
                <dl className="pf-kv">
                  {filled.map((f) => <div key={f.key} className="pf-row"><dt>{f.label}</dt><dd>{show(f.type, cur[f.key])}</dd></div>)}
                  {mine.map((x) => <div key={x.id} className="pf-row"><dt>{x.label}</dt><dd>{show(x.type, x.value) ?? <span className="muted">Not recorded</span>}</dd></div>)}
                  {!filled.length && !mine.length && <p className="tiny muted">Nothing recorded yet.</p>}
                  {filled.length > 0 && filled.length < s.fields.length && <p className="tiny muted">{s.fields.length - filled.length} more to fill when you know them.</p>}
                </dl>
              )}
            </section>
          )
        })}
      </div>
    </Panel>
  )
}

function AddField({ c, sections, library, onDone }: { c: any; sections: Section[]; library: any[]; onDone: () => void }) {
  const [pick, setPick] = useState('')
  const [f, setF] = useState<{ label: string; type: string; section: string; value: any; save: boolean }>({ label: '', type: 'text', section: 'traits', value: null, save: true })
  const { busy, run } = useAction()
  const toast = useToast()
  const editable = sections.filter((s) => !s.locked && !(s.consent && !c.consent?.[s.consent]))
  const choose = (label: string) => {
    setPick(label)
    const l = library.find((x) => x.label === label)
    if (l) setF({ ...f, label: l.label, type: l.type, section: editable.some((s) => s.key === l.section) ? l.section : 'traits', value: null, save: false })
    else setF({ ...f, label: '', type: 'text', value: null, save: true })
  }
  const add = () => run(async () => {
    await api('/actions/add_custom_field', { body: { client_id: c.id, label: f.label, type: f.type, section: f.section, value: f.value, save_to_library: !pick && f.save } })
    toast(`Added “${f.label}” to ${c.first_name}’s profile`)
    onDone()
  }, 'The field wasn’t added')
  return (
    <div className="action-form pf-add">
      <label className="field"><span>Field</span>
        <select className="select" value={pick} onChange={(e) => choose(e.target.value)}>
          <option value="">Create a new field</option>
          {library.map((x) => <option key={x.label} value={x.label}>{x.label}</option>)}
        </select>
      </label>
      {!pick && (
        <div className="grid g2" style={{ gap: 10 }}>
          <label className="field"><span>Name</span><input className="input" value={f.label} placeholder="Preferred golf course" onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
          <label className="field"><span>Kind of answer</span>
            <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, value: null })}>
              <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="yes_no">Yes or no</option>
            </select>
          </label>
        </div>
      )}
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field"><span>Section</span>
          <select className="select" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>{editable.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <label className="field"><span>Value</span><Input f={{ label: 'Value', type: f.type }} value={f.value} onChange={(v) => setF({ ...f, value: v })} /></label>
      </div>
      {!pick && <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={f.save} onChange={(e) => setF({ ...f, save: e.target.checked })} />Save to the field library for other clients</label>}
      <div className="row"><button className="btn btn-primary btn-sm" disabled={busy || !f.label.trim()} onClick={add}>Add field</button><button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button></div>
    </div>
  )
}
