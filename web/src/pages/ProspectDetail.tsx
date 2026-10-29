import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, LayoutGrid, ListChecks, Lock, Phone, CalendarPlus, UserCheck, XCircle, RotateCcw } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { pushRecent } from '../lib/session'
import { useAction } from '../lib/action'
import { RISK_ORDER, STAGES, STAGE_INFO, useMeetings, usePortfolios, useProducts } from '../lib/data'
import { ago, date, inr, when, sourceText, label } from '../lib/format'
import { Avatar, DetailSkeleton, Drawer, Empty, Modal, Num, Panel, Status, useToast } from '../ui'
import AgentPanel from '../agent/AgentPanel'
import { ActionsPanel, ContextBar, Timeline } from './shared'

export default function ProspectDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: p, error } = useApi<any>(`/c/prospects/${id}`)
  const { data: gate, reload: reloadGates } = useApi<any>(`/prospects/${id}/gates`)
  const [converting, setConverting] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { if (p) pushRecent({ kind: 'prospect', id: p.id, title: p.name, sub: `Prospect · ${p.stage}` }) }, [p?.id])
  const { data: products = [] } = useProducts()
  const { data: meetings = [] } = useMeetings()
  const { data: portfolios = [] } = usePortfolios()
  const [closing, setClosing] = useState(false)
  const panel = params.get('panel')
  const setPanel = (x: string | null, extra: Record<string, string> = {}) => setParams(x ? { panel: x, ...extra } : {})
  const [prompt, setPrompt] = useState<string | null>(null)
  const toast = useToast()
  const { busy, run } = useAction()
  const P = useMemo(() => Object.fromEntries(products.map((x) => [x.id, x])), [products])
  if (error) return <main className="page"><Empty title="Prospect not found" action={<Link className="btn btn-quiet" to="/prospects">Back to prospects</Link>} /></main>
  if (!p) return <DetailSkeleton />

  const ask = params.get('ask')
  const momFor = params.get('mom') ? meetings.find((m) => m.id === params.get('mom')) : null
  const initial = prompt ?? (momFor ? `Log the MoM for "${momFor.title}" (${momFor.id}): ` : null) ?? (ask === 'nudge' ? `Draft a short WhatsApp nudge to ${p.name.split(' ')[0]} about what they looked at in the app.` : ask === 'kyc' ? `Draft a friendly reminder to ${p.name.split(' ')[0]} about the pending KYC steps.` : null)
  const mine = meetings.filter((m) => m.with.id === p.id).sort((a, b) => b.start.localeCompare(a.start))
  const pfs = portfolios.filter((x) => x.tag?.id === p.id)
  const stageIdx = STAGES.indexOf(p.stage)
  const G: Record<string, any> = Object.fromEntries((gate?.stages || []).map((g: any) => [g.stage, g]))
  const ahead = (i: number) => i > stageIdx
  const blocked = (s: string, i: number) => ahead(i) && G[s] && !G[s].ok
  const setStage = (s: string) => {
    if (s === p.stage) return
    const i = STAGES.indexOf(s)
    if (blocked(s, i)) { toast(<>{s} needs: {G[s].missing.join(', ')}.</>); return }
    const prev = p.stage
    const move = async (to: string) => { await api(`/prospects/${p.id}/stage`, { body: { stage: to } }); invalidate('/c/prospects'); reloadGates() }
    run(async () => {
      await move(s)
      toast(<>Moved to {s}. <button className="toast-undo" onClick={() => run(async () => { await move(prev); toast(`Back to ${prev}`) }, 'Couldn’t undo the stage change')}>Undo</button></>)
    }, 'Couldn’t change the stage')
  }
  const markStep = (step: string, risk_profile?: string) => run(async () => {
    await api(`/prospects/${p.id}/kyc_step`, { body: { step, done: true, risk_profile } })
    invalidate('/c/prospects'); reloadGates()
    toast(`${step} marked done`)
  }, 'The step wasn’t updated')
  const canConvert = !p.converted && ['Investing client', 'Investing and trading client'].includes(p.stage)
  const reopen = () => run(async () => { await api(`/prospects/${p.id}/reopen`, { method: 'POST' }); invalidate('/c/prospects'); toast('Reopened') }, 'Couldn’t reopen the prospect')
  const names = { [p.id]: p.name, ...Object.fromEntries(products.map((x) => [x.id, x.name])) }

  return (
    <main className="page has-ctxbar">
      <Link to="/prospects" className="crumb"><ArrowLeft size={14} />Prospects</Link>
      <header className="profile-head panel" style={{ paddingBottom: 22 }}>
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          <Avatar name={p.name} size={68} />
          <div className="grow">
            <h1>{p.name}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{p.age ? `${p.age} · ` : ''}{p.city} · {sourceText(p.source, p.source_detail)} · added {date(p.created, true)}</p>
            <p style={{ marginTop: 10, maxWidth: 640 }}>{p.need}</p>
          </div>
          <div className="stat" style={{ textAlign: 'right' }}>
            <span className="label">Estimated investable</span>
            <span className="value l"><Num v={p.estimated_investable} src="Your estimate" /></span>
            <span className="sub">{p.probability}% likely at this stage</span>
          </div>
        </div>
        {p.converted ? (
          <div className="closed-banner converted">
            <UserCheck size={18} aria-hidden />
            <div className="grow small"><span className="strong">Became a client on {date(p.converted.date, true)}.</span> This prospect record is kept as history.</div>
            <Link className="btn btn-quiet btn-sm" to={`/clients/${p.converted.client_id}`}>Open client page</Link>
          </div>
        ) : p.stage === 'Closed' ? (
          <div className="closed-banner">
            <XCircle size={18} />
            <div className="grow small"><span className="strong">Closed {date(p.closed?.date)}.</span> {p.closed?.reason} {p.closed?.learning && <span className="muted">Learning: {p.closed.learning}</span>}</div>
            <button className="btn btn-quiet btn-sm" disabled={busy} onClick={reopen}><RotateCcw />Reopen</button>
          </div>
        ) : (
          <ol className="stage-track" aria-label="Stage">
            {STAGES.map((s, i) => (
              <li key={s} className={`stage ${i < stageIdx ? 'done' : i === stageIdx ? 'on' : ''} ${blocked(s, i) ? 'locked' : ''}`}>
                <button className="stage-btn" onClick={() => setStage(s)} disabled={busy}
                  title={i === stageIdx ? STAGE_INFO[s] : blocked(s, i) ? `${s} needs: ${G[s].missing.join(', ')}` : `Move to ${s}: ${STAGE_INFO[s]}`}
                  aria-current={i === stageIdx ? 'step' : undefined}>
                  <span className="stage-dot" aria-hidden>{i < stageIdx ? <Check size={11} /> : blocked(s, i) ? <Lock size={9} /> : null}</span>
                  <span className="stage-name">{s}</span>
                  {blocked(s, i) && <span className="sr-only">, needs {G[s].missing.length} more {G[s].missing.length === 1 ? 'step' : 'steps'}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
        {canConvert && (
          <div className="convert-row">
            <p className="small grow">{p.name.split(' ')[0]} has everything needed to invest. Make them a client once they’ve given their consent.</p>
            <button className="btn btn-primary" onClick={() => setConverting(true)}><UserCheck aria-hidden />Make {p.name.split(' ')[0]} a client</button>
          </div>
        )}
      </header>

      <div className="grid g-main-wide" style={{ marginTop: 16 }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <Panel title="Next step">
              {p.next_step ? <><div className="display" style={{ fontSize: 18, color: 'var(--ink-strong)' }}>{p.next_step}</div><div className="small muted">{when(p.next_step_date)}</div></> : <p className="small muted">None set.</p>}
              {mine.filter((m) => m.status === 'scheduled')[0] && <div className="small" style={{ marginTop: 10 }}>Meeting: {mine.filter((m) => m.status === 'scheduled')[0].title}, {when(mine.filter((m) => m.status === 'scheduled')[0].start)}</div>}
            </Panel>
            <Panel title="Account readiness" aside={`${p.kyc_steps.filter((s: any) => s.done).length} of ${p.kyc_steps.length} done`}>
              <div className="col" style={{ gap: 5 }}>
                {p.kyc_steps.map((s: any) => (
                  <div key={s.step} className="row small kyc-row" style={{ gap: 8 }}>
                    <span className={`kyc-dot ${s.done ? 'done' : ''}`}>{s.done && <Check size={10} />}</span>
                    <span className={`grow ${s.done ? '' : 'muted'}`}>{s.step}{s.step === 'Risk profile' && s.done && p.risk_profile ? `: ${p.risk_profile}` : ''}</span>
                    {!s.done && !p.converted && (s.step === 'Risk profile'
                      ? <select className="select sm" aria-label="Risk profile result" value="" disabled={busy} onChange={(e) => e.target.value && markStep(s.step, e.target.value)}>
                          <option value="">Record result</option>{RISK_ORDER.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      : <button className="linkbtn tiny" disabled={busy} onClick={() => markStep(s.step)}>Mark done</button>)}
                  </div>
                ))}
              </div>
              {!p.converted && <p className="tiny muted" style={{ marginTop: 10 }}>Operations confirms these in the full product. In this demo you mark them yourself.</p>}
            </Panel>
          </div>

          <Panel title="Timeline" aside="Everything here was entered by you or the agent">
            <Timeline items={p.timeline} />
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel title="Interested in">
            {p.interests.length === 0 && <p className="small muted">No products noted yet.</p>}
            <div className="col" style={{ gap: 0 }}>
              {p.interests.map((i: string) => P[i] && (
                <Link key={i} to={`/products/${i}`} className="w-line"><span className="grow small">{P[i].name}<br /><span className="tiny muted">{P[i].sub_category}</span></span><Status s={P[i].cio_view.stance} /></Link>
              ))}
            </div>
          </Panel>
          {p.suggestions.length > 0 && (
            <Panel title="Suggestions from the team">
              {p.suggestions.map((s: any, i: number) => (
                <div key={i} className="note-card" style={{ marginBottom: 8 }}>
                  <div className="tiny muted">{s.from.name}, {s.from.title} · {date(s.date)}</div>
                  <div className="small strong" style={{ margin: '4px 0' }}>{P[s.product_id]?.name}</div>
                  <div className="small">{s.text}</div>
                </div>
              ))}
            </Panel>
          )}
          {p.app_activity?.length > 0 && (
            <Panel title="In Kova Client">
              {p.app_activity.map((a: any, i: number) => <div key={i} className="w-line small"><span className="grow">{a.text}</span><span className="tiny muted">{ago(a.at)}</span></div>)}
            </Panel>
          )}
          <Panel title="Details">
            <dl className="kv" style={{ gridTemplateColumns: '120px 1fr' }}>
              <dt>Mobile</dt><dd>{p.phone || '—'}</dd><dt>Email</dt><dd className="ellipsis">{p.email || '—'}</dd>
              <dt>Risk indication</dt><dd>{p.risk_indication}</dd><dt>Meetings held</dt><dd>{p.meetings_held}</dd><dt>Last contact</dt><dd>{ago(p.last_contact)}</dd>
              <dt>Kova Client</dt><dd>{p.app_access ? 'Has access' : <>No access yet <span className="muted">(arrives with Kova Client)</span></>}</dd>
            </dl>
            {p.stage !== 'Closed' && <button className="btn btn-danger btn-sm" style={{ marginTop: 14 }} onClick={() => setClosing(true)}><XCircle />Close prospect</button>}
          </Panel>
        </div>
      </div>

      {converting && <ConvertModal p={p} onClose={() => setConverting(false)} onDone={(cid) => { setConverting(false); invalidate('/c/'); navigate(`/clients/${cid}`) }} />}
      <ContextBar agentOn={panel === 'agent'} onAgent={() => setPanel(panel === 'agent' ? null : 'agent')}>
        <button className={`cb ${panel === 'proposal' ? 'on' : ''}`} onClick={() => setPanel(panel === 'proposal' ? null : 'proposal')}><LayoutGrid />Proposal</button>
        <button className={`cb ${panel === 'actions' ? 'on' : ''}`} onClick={() => setPanel(panel === 'actions' ? null : 'actions')}><ListChecks />Actions</button>
        <span className="sep" />
        <button className="cb minor" title="Call" aria-label={`Call ${p.name}`} onClick={() => toast(`Call ${p.name} on ${p.phone}`)}><Phone aria-hidden /></button>
        <button className="cb minor" title="Schedule a meeting" aria-label="Schedule a meeting" onClick={() => setPanel('actions', { do: 'schedule' })}><CalendarPlus aria-hidden /></button>
      </ContextBar>

      {panel === 'proposal' && (
        <Drawer title="Proposal" sub={p.name} scrim={false} onClose={() => setPanel(null)}
          foot={<Link className="btn btn-primary" to={`/studio?new=1&tag=prospect:${p.id}`}>{pfs.length ? 'Start another portfolio' : `Create a portfolio for ${p.name.split(' ')[0]}`}</Link>}>
          {pfs.length === 0 ? (
            <Empty title="No portfolio yet">Build one in the Studio. {p.name.split(' ')[0]} will be tagged already.</Empty>
          ) : pfs.map((pf) => {
            const used = pf.lines.reduce((a: number, l: any) => a + l.amount, 0)
            return (
              <div key={pf.id} className="note-card" style={{ marginBottom: 10 }}>
                <div className="spread"><span className="strong">{pf.name}</span><Status s={pf.status} /></div>
                <div className="tiny muted">{pf.id} · updated {ago(pf.updated)}</div>
                <div className="small" style={{ margin: '10px 0' }}>{inr(used)} across {pf.lines.length} products</div>
                <div className="col" style={{ gap: 3 }}>{pf.lines.map((l: any) => <div key={l.product_id} className="spread tiny"><span>{P[l.product_id]?.name}</span><span className="num">{inr(l.amount)}</span></div>)}</div>
                <Link to={`/studio/${pf.id}`} className="btn btn-quiet btn-sm" style={{ marginTop: 12 }}>Open in Studio</Link>
              </div>
            )
          })}
        </Drawer>
      )}
      {panel === 'actions' && (
        <Drawer title="Actions" sub={p.name} scrim={false} onClose={() => setPanel(null)}>
          <ActionsPanel kind="prospect" id={p.id} name={p.name} initial={params.get('do')} onAskAgent={(x) => { setPrompt(x); setPanel('agent') }} />
        </Drawer>
      )}
      {panel === 'agent' && <AgentPanel key={initial || 'a'} scope={{ kind: 'prospect', id: p.id }} name={p.name} names={names} initialText={initial} onClose={() => setPanel(null)} />}
      {closing && <CloseProspect p={p} onClose={() => setClosing(false)} />}
    </main>
  )
}

function CloseProspect({ p, onClose }: { p: any; onClose: () => void }) {
  const [reason, setReason] = useState('Chose another firm')
  const [learning, setLearning] = useState('')
  const toast = useToast()
  const { busy, run } = useAction()
  const close = () => run(async () => { await api(`/prospects/${p.id}/close`, { body: { reason, learning } }); invalidate('/c/prospects'); toast('Prospect closed'); onClose() }, 'Couldn’t close the prospect')
  return (
    <Modal title={`Close ${p.name}`} sub="The record and everything learned stays on file. You can reopen any time." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={close}>{busy ? 'Closing…' : 'Close prospect'}</button></>}>
      <div className="col" style={{ gap: 12 }}>
        <label className="field"><span>Why</span><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{['Chose another firm', 'Not ready yet; revisit later', 'Fees', 'Investable amount too small', 'Unreachable', 'Other'].map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field"><span>What would you do differently?</span><textarea className="textarea" value={learning} onChange={(e) => setLearning(e.target.value)} /></label>
      </div>
    </Modal>
  )
}

/* The RM confirms; the client's consent is recorded as they gave it, nothing is assumed */
const CONSENTS: [string, string][] = [
  ['email', 'Email for statements and updates'],
  ['whatsapp', 'WhatsApp messages'],
  ['profile_enrichment', 'Using personal details they share to personalise advice'],
  ['marketing', 'Offers and product news'],
  ['data_sharing_with_partners', 'Sharing data with partner firms'],
]
function ConvertModal({ p, onClose, onDone }: { p: any; onClose: () => void; onDone: (clientId: string) => void }) {
  const [consent, setConsent] = useState<Record<string, boolean>>({ email: false, whatsapp: false, profile_enrichment: false, marketing: false, data_sharing_with_partners: false })
  const { busy, run } = useAction()
  const toast = useToast()
  const first = p.name.split(' ')[0]
  const go = () => run(async () => {
    const r = await api('/actions/convert_prospect', { body: { prospect_id: p.id, consent } })
    toast(r.outbox ? `${first} is now a client. A welcome email is in the outbox.` : `${first} is now a client.`)
    onDone(r.client.id)
  }, `${first} wasn’t made a client`)
  return (
    <Modal title={`Make ${first} a client`} sub={`${p.stage} · risk profile ${p.risk_profile || p.risk_indication}`} onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}><UserCheck aria-hidden />Make {first} a client</button></>}>
      <p className="small">This creates {first}’s client record and a new family with them as head, and keeps everything from the prospect record on their timeline.</p>
      <fieldset className="consent-set">
        <legend className="small strong">What {first} consented to</legend>
        <p className="tiny muted">Tick only what they agreed to on the consent form. You can change consent later on the client page.</p>
        {CONSENTS.map(([k, label]) => (
          <label key={k} className="check small"><input type="checkbox" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} />{label}</label>
        ))}
      </fieldset>
      {!consent.email && <p className="tiny muted">Without email consent the welcome email isn’t sent.</p>}
    </Modal>
  )
}
