import { Fragment, useRef, useState } from 'react'
import { Award, BookOpen, Camera, Download, Languages, RotateCcw } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { useClients, useGrowth, useRm } from '../lib/data'
import { date, inr, setNumberStyle, when } from '../lib/format'
import { pref, setPref } from '../lib/session'
import { resizeImage } from '../shell/ProfileMenu'
import { AmountInput, Avatar, DetailSkeleton, Num, Panel, Stat, useToast } from '../ui'

export function Profile() {
  const { data: rm } = useRm()
  const { data: clients = [] } = useClients()
  const { data: growth } = useGrowth()
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { busy, run } = useAction()
  if (!rm) return <DetailSkeleton />
  const aum = clients.reduce((a, c) => a + c.aum, 0)
  const upload = (f?: File) => f && run(async () => { await api('/s/rm', { method: 'PATCH', body: { photo: await resizeImage(f, 320) } }); invalidate('/s/rm'); toast('Photo updated') }, 'Couldn’t update your photo')
  return (
    <main className="page">
      <div className="page-head"><div><h1>My profile</h1><p className="lede">How you appear to colleagues and, once Kova Client launches, to your clients.</p></div>
        <button className="btn btn-quiet" onClick={() => toast('Your shareable profile card arrives with Kova Client.')}><Download />Download profile card</button></div>
      <div className="grid g-main">
        <section className="panel panel-pad">
          <div className="row" style={{ gap: 20 }}>
            <button onClick={() => file.current?.click()} style={{ position: 'relative', borderRadius: '50%' }} aria-label="Change profile photo" disabled={busy}>
              <Avatar name={rm.name} photo={rm.photo} size={96} />
              <span className="photo-edit"><Camera size={14} /></span>
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
            <div><h2 style={{ fontSize: 26 }}>{rm.name}</h2><p className="muted">{rm.title} · {rm.grade} · {rm.branch}</p><p className="small" style={{ marginTop: 8, maxWidth: 520 }}>{rm.about}</p></div>
          </div>
          <div className="statline" style={{ margin: '22px -20px -18px', borderTop: '1px solid var(--line)' }}>
            <Stat label="Assets in your care" value={<Num v={aum} />} />
            <Stat label="Clients" value={clients.filter((c) => c.segment !== 'lost').length} />
            <Stat label="With Kova since" value={date(rm.joined, true)} />
            <Stat label="Points this quarter" value={growth?.points?.this_quarter ?? '—'} />
          </div>
        </section>
        <div className="col" style={{ gap: 16 }}>
          <Panel title="Credentials">
            <dl className="kv small" style={{ gridTemplateColumns: '90px 1fr' }}><dt>ARN</dt><dd>{rm.arn}</dd><dt>EUIN</dt><dd>{rm.euin}</dd><dt>Email</dt><dd>{rm.email}</dd><dt>Mobile</dt><dd>{rm.phone}</dd><dt>Reports to</dt><dd>{rm.manager.name}, {rm.manager.title}</dd></dl>
          </Panel>
          <Panel title="Certifications"><div className="col small" style={{ gap: 6 }}>{rm.certifications.map((c: string) => <div key={c} className="row" style={{ gap: 8 }}><Award size={14} color="var(--forest)" aria-hidden />{c}</div>)}</div></Panel>
          <Panel title="Languages"><div className="row small" style={{ gap: 8 }}><Languages size={14} />{rm.languages.join(', ')}</div></Panel>
        </div>
      </div>
    </main>
  )
}

export function Preferences() {
  const toast = useToast()
  const [prefs, setPrefs] = useState(() => pref('prefs', { digest: true, contests: true, cio: true, quiet: '21:00', numbers: 'lakh-crore', agentVoice: true }))
  const set = (k: string, v: any) => { const n = { ...prefs, [k]: v }; setPrefs(n); setPref('prefs', n) }
  const [confirm, setConfirm] = useState(false)
  const { busy, run } = useAction()
  const reset = () => run(async () => { await api('/reset', { method: 'POST' }); invalidate(''); setConfirm(false); toast('Demo data reset') }, 'Couldn’t reset the demo data')
  return (
    <main className="page">
      <div className="page-head"><div><h1>Preferences</h1><p className="lede">How Kova Work behaves for you. Saved on this device in this preview.</p></div></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Panel title="Updates & upcoming" aside="Coming in the next release">
          <div className="col" style={{ gap: 12 }}>
            <p className="small muted">Choose what reaches your Updates panel and when it goes quiet. These settings arrive with notifications in the full release.</p>
            <label className="check toggle-off"><input type="checkbox" checked disabled readOnly />Morning summary of the day at 8:30 am</label>
            <label className="check toggle-off"><input type="checkbox" checked disabled readOnly />Contest standings</label>
            <label className="check toggle-off"><input type="checkbox" checked disabled readOnly />CIO notes and product changes</label>
            <label className="field toggle-off" style={{ maxWidth: 220 }}><span>Quiet after</span><input className="input" type="time" value="21:00" disabled readOnly /></label>
          </div>
        </Panel>
        <Panel title="Display">
          <div className="col" style={{ gap: 12 }}>
            <label className="field" style={{ maxWidth: 280 }}><span>Large numbers</span><select className="select" value={prefs.numbers} onChange={(e) => { set('numbers', e.target.value); setNumberStyle(e.target.value as 'lakh-crore' | 'full'); invalidate(''); toast(e.target.value === 'full' ? 'Large numbers now show in full' : 'Large numbers now show in lakh and crore') }}><option value="lakh-crore">Lakh and crore (₹1.2 Cr)</option><option value="full">Full figures (₹1,20,00,000)</option></select></label>
            <label className="check toggle-off"><input type="checkbox" disabled />Dark theme <span className="tiny muted">(coming later)</span></label>
            <label className="check"><input type="checkbox" checked={prefs.agentVoice} onChange={(e) => set('agentVoice', e.target.checked)} />Show the live transcript while I speak to the agent</label>
          </div>
        </Panel>
        <ExpensePolicy />
        <Panel title="Demo data">
          <p className="small muted" style={{ marginBottom: 12 }}>Puts every client, meeting, request and session back to the starting sample, with dates moved to this week. Agent sessions and outbox items you created are removed.</p>
          {confirm ? <div className="row"><button className="btn btn-danger" disabled={busy} onClick={reset}><RotateCcw />{busy ? 'Resetting…' : 'Yes, reset everything'}</button><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
            : <button className="btn btn-quiet" onClick={() => setConfirm(true)}><RotateCcw />Reset demo data</button>}
        </Panel>
      </div>
    </main>
  )
}

/* The branch head sets the limits; the demo lets you play that role to try them */
function ExpensePolicy() {
  const { data: p, reload } = useApi<any>('/expenses/policy')
  const [edit, setEdit] = useState<any>(null)
  const { busy, run } = useAction()
  const toast = useToast()
  if (!p) return <Panel title="Expense policy"><p className="small muted">Loading…</p></Panel>
  const save = () => run(async () => {
    await api('/expenses/policy', { method: 'PUT', body: { ...edit, by: p.approver } })
    invalidate('/expenses/'); reload(); setEdit(null); toast('Expense policy updated')
  }, 'The policy wasn’t saved')
  const last = p.history?.[p.history.length - 1]
  return (
    <Panel title="Expense policy" aside={`Set by ${p.set_by.split(',')[0]}`}>
      {edit ? (
        <div className="col" style={{ gap: 10 }}>
          <p className="small muted">You’re changing this as your branch head. Claims above these limits go to them before Accounts.</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="field"><span>Monthly limit</span><AmountInput label="Monthly limit" value={edit.monthly_cap} onChange={(v) => setEdit({ ...edit, monthly_cap: v })} /></label>
            <label className="field"><span>Bill needed above</span><AmountInput label="Bill needed above" value={edit.bill_required_above} onChange={(v) => setEdit({ ...edit, bill_required_above: v })} /></label>
          </div>
          <div className="grid g2" style={{ gap: 10 }}>
            {Object.entries(edit.category_limits).map(([cat, v]) => (
              <label key={cat} className="field"><span>{cat}, per claim</span><AmountInput label={`${cat} limit`} value={Number(v)} onChange={(n) => setEdit({ ...edit, category_limits: { ...edit.category_limits, [cat]: n } })} /></label>
            ))}
          </div>
          <div className="row"><button className="btn btn-primary" disabled={busy} onClick={save}>Save policy</button><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <dl className="kv small" style={{ gridTemplateColumns: '170px 1fr' }}>
            <dt>Monthly limit</dt><dd className="num">{inr(p.monthly_cap, { compact: false })}</dd>
            <dt>Bill needed above</dt><dd className="num">{inr(p.bill_required_above, { compact: false })}</dd>
            <dt>Claim within</dt><dd>{p.claim_within_days} days of the bill</dd>
            {Object.entries(p.category_limits).map(([cat, v]) => <Fragment key={cat}><dt>{cat}</dt><dd className="num">{inr(Number(v), { compact: false })} per claim</dd></Fragment>)}
          </dl>
          {last && <p className="tiny muted">Last change {when(last.at)}: {last.text}</p>}
          <div><button className="btn btn-quiet" onClick={() => setEdit({ monthly_cap: p.monthly_cap, bill_required_above: p.bill_required_above, category_limits: { ...p.category_limits } })}>Change as branch head</button></div>
        </div>
      )}
    </Panel>
  )
}

export function Handbook() {
  const { data: topics = [] } = useApi<any[]>('/c/handbook')
  return (
    <main className="page">
      <div className="page-head"><div><h1>Handbook</h1><p className="lede">Learn how Kova Work fits together: the pages, the agent, statuses, and what consent allows. Full guides arrive in the next release.</p></div></div>
      <div className="grid g3">
        {topics.map((t) => (
          <section key={t.id} className="panel panel-pad handbook-card">
            <BookOpen size={18} color="var(--forest)" aria-hidden />
            <h3 style={{ margin: '10px 0 4px' }}>{t.title}</h3>
            <p className="small muted">{t.minutes} min read</p>
            <span className="pill outline" style={{ marginTop: 10 }}>Coming soon</span>
          </section>
        ))}
      </div>
    </main>
  )
}
