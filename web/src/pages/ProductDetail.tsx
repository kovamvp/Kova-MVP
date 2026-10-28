import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, CircleHelp, FileText, GraduationCap, PlayCircle, Send } from 'lucide-react'
import { api, invalidate, useApi } from '../lib/api'
import { useAction } from '../lib/action'
import { useClients, useGrowth, useLd } from '../lib/data'
import { date, inr, label } from '../lib/format'
import { Avatar, Bar, DetailSkeleton, Drawer, Empty, Num, Panel, Stat, Status, useToast } from '../ui'
import AgentPanel from '../agent/AgentPanel'
import { ContextBar, FeedbackForm } from './shared'
import { suitsCount } from './Products'

const MOD_ICON: Record<string, any> = { reading: BookOpen, video: PlayCircle, document: FileText, quiz: CircleHelp }

export default function ProductDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: p, error } = useApi<any>(`/c/products/${id}`)
  const { data: clients = [] } = useClients()
  const { data: ld = [] } = useLd()
  const { data: growth } = useGrowth()
  const panel = params.get('panel')
  const setPanel = (x: string | null) => setParams(x ? { panel: x } : {})
  const [feedback, setFeedback] = useState(false)
  const names = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients])
  if (error) return <main className="page"><Empty title="Product not found" action={<Link className="btn btn-quiet" to="/products">Back to products</Link>} /></main>
  if (!p) return <DetailSkeleton />

  const done: string[] = ld.find((x) => x.product_id === p.id)?.completed || []
  const mods = p.ld.modules
  const pct = Math.round((done.filter((d) => mods.some((m: any) => m.id === d)).length / mods.length) * 100)
  const holders = clients.filter((c) => c.holdings.some((h: any) => h.product_id === p.id)).map((c) => ({ c, h: c.holdings.find((h: any) => h.product_id === p.id) }))
  const fits = suitsCount(p, clients)
  const contest = growth?.contests?.find((c: any) => c.id === p.rewards.contest)
  const ask = params.get('ask')
  const nums: [string, string][] = []
  if (p.returns?.['1y']) nums.push(['1-year return', `${p.returns['1y']}%`])
  if (p.returns?.['3y']) nums.push(['3-year return, a year', `${p.returns['3y']}%`])
  if (p.returns?.['5y']) nums.push(['5-year return, a year', `${p.returns['5y']}%`])
  if (p.ytm) nums.push(['Yield to maturity', `${p.ytm}%`])
  if (p.coupon) nums.push(['Coupon', `${p.coupon}%`])
  if (p.rate) nums.push(['Rate', `${p.rate}%`])
  if (p.target_irr) nums.push(['Target IRR', p.target_irr])
  nums.push(['Minimum', inr(p.min_investment, { compact: false })])
  if (p.expense_ratio) nums.push(['Expense ratio', `${p.expense_ratio}%`])

  return (
    <main className="page has-ctxbar">
      <Link to="/products" className="crumb"><ArrowLeft size={14} />Products</Link>
      <header className="panel profile-head" style={{ paddingBottom: 20 }}>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 24 }}>
          <div className="grow">
            <div className="small muted">{p.manufacturer} · {p.category}</div>
            <h1 style={{ marginTop: 4 }}>{p.name}</h1>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <span className="pill outline">{p.sub_category}</span><span className="pill outline">Risk: {p.risk}</span>
              <Status s={p.cio_view.stance}>CIO: {p.cio_view.stance}</Status>
              {p.is_new && <span className="pill forest">New on the shelf</span>}
              {p.close_date && <span className="pill brass">Closes {date(p.close_date, true)}</span>}
            </div>
          </div>
          <button className="ld-head" onClick={() => setPanel('ld')}>
            <div className="spread small"><span className="strong row" style={{ gap: 6 }}><GraduationCap size={15} />Your learning</span><span className="num">{pct}%</span></div>
            <Bar v={pct} />
            <div className="tiny muted">{pct === 100 ? 'Completed. Revisit any time.' : pct > 0 ? `${mods.length - done.length} of ${mods.length} steps left` : `${mods.length} steps, about ${mods.reduce((a: number, m: any) => a + m.minutes, 0)} minutes`}</div>
          </button>
        </div>
        <div className="statline" style={{ margin: '18px -24px 0', borderTop: '1px solid var(--line)' }}>
          {nums.slice(0, 5).map(([k, v]) => <Stat key={k} label={k} value={<span className="num">{v}</span>} />)}
        </div>
      </header>

      <div className="grid g-main-wide" style={{ marginTop: 16 }}>
        <div className="col" style={{ gap: 16 }}>
          <section className="cio-card">
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span className="ring lg" />
              <span className="small">CIO view · {p.cio_view.author.name}, {p.cio_view.author.title} · {date(p.cio_view.date)}</span>
            </div>
            <p className="cio-text">{p.cio_view.comment}</p>
          </section>

          <div className="grid g2">
            <Panel title="Why it works"><ul className="clean">{p.highlights.map((h: string) => <li key={h}>{h}</li>)}</ul></Panel>
            <Panel title="What can go wrong"><ul className="clean risk">{p.risks.map((h: string) => <li key={h}>{h}</li>)}</ul></Panel>
          </div>

          <Panel title="Details">
            <dl className="kv">
              <dt>Liquidity</dt><dd>{p.liquidity}</dd>
              {p.fee && <><dt>Fees</dt><dd>{p.fee}</dd></>}
              {p.benchmark && <><dt>Benchmark</dt><dd>{p.benchmark}</dd></>}
              {p.fund_manager && <><dt>Fund manager</dt><dd>{p.fund_manager}</dd></>}
              {p.rating && <><dt>Rating</dt><dd>{p.rating}</dd></>}
              {p.maturity && <><dt>Maturity</dt><dd>{date(p.maturity, true)}</dd></>}
              {p.payout && <><dt>Payout</dt><dd>{p.payout}</dd></>}
              {p.aum_cr && <><dt>Fund size</dt><dd>₹{p.aum_cr.toLocaleString('en-IN')} Cr</dd></>}
              {p.duration_yrs && <><dt>Duration</dt><dd>{p.duration_yrs} years</dd></>}
              {p.ltv && <><dt>Loan to value</dt><dd>{p.ltv}</dd></>}
              <dt>On the shelf since</dt><dd>{date(p.launched, true)}</dd>
            </dl>
          </Panel>

          <Panel title="From the product team">
            {p.comments.map((c: any, i: number) => (
              <div key={i} className="pm-comment">
                <Avatar name={c.by.name} size={30} />
                <div><div className="small"><span className="strong">{c.by.name}</span> <span className="muted">· {c.by.title} · {date(c.date)}</span></div><p className="small" style={{ marginTop: 2 }}>{c.text}</p></div>
              </div>
            ))}
            <button className="btn btn-quiet btn-sm" style={{ marginTop: 10 }} onClick={() => setFeedback((f) => !f)}><Send />Send feedback to {p.product_manager.name}</button>
            {feedback && <FeedbackForm productId={p.id} onDone={() => setFeedback(false)} />}
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>

          <Panel title="Your clients holding it" aside={holders.length ? inr(holders.reduce((a, x) => a + x.h.value, 0)) : undefined}>
            {holders.length === 0 && <p className="small muted">None yet.</p>}
            {holders.map(({ c, h }) => <Link key={c.id} to={`/clients/${c.id}`} className="row small fam-member"><Avatar name={c.name} size={26} /><span className="grow">{c.name}</span><Num v={h.value} fixed /></Link>)}
          </Panel>

          <Panel title="Clients it suits" aside="Risk profile and ticket size">
            {fits.length === 0 && <p className="small muted">No current client fits both risk and ticket size.</p>}
            {fits.slice(0, 6).map((c) => <Link key={c.id} to={`/clients/${c.id}`} className="row small fam-member"><Avatar name={c.name} size={26} /><span className="grow">{c.name}<span className="tiny muted"> · {c.risk_profile}</span></span><span className="num muted">{inr(c.aum, { fixed: true })}</span></Link>)}
          </Panel>
          <section className="reward-card" aria-label="Rewards">
            <div className="spread"><span className="row small strong" style={{ gap: 8 }}><span className="ring" aria-hidden />Rewards</span>{contest && <Link to="/growth" className="linkbtn small">{contest.name}, ends {date(contest.ends)}</Link>}</div>
            <div style={{ margin: '6px 0 2px' }}><span className="reward-figure num">{p.rewards.points_per_lakh}</span> <span className="small muted">points per lakh</span></div>
            <p className="tiny muted" style={{ marginTop: 8 }}>Points follow suitable sales only. A sale flagged as unsuitable earns nothing and is reviewed.</p>
          </section>
        </div>
      </div>

      <ContextBar agentOn={panel === 'agent'} onAgent={() => setPanel(panel === 'agent' ? null : 'agent')}>
        <button className={`cb ${panel === 'ld' ? 'on' : ''}`} onClick={() => setPanel(panel === 'ld' ? null : 'ld')}><GraduationCap />Learning <span className="tiny" style={{ opacity: 0.7 }}>{pct}%</span></button>
      </ContextBar>

      {panel === 'ld' && <LearningPanel p={p} done={done} onClose={() => setPanel(null)} />}
      {panel === 'agent' && <AgentPanel key={ask || 'a'} scope={{ kind: 'product', id: p.id }} name={p.name} names={names} onClose={() => setPanel(null)} initialText={ask === 'clients' ? 'Which of my clients does this suit, and why?' : null} />}
    </main>
  )
}

function LearningPanel({ p, done, onClose }: { p: any; done: string[]; onClose: () => void }) {
  const toast = useToast()
  const mods = p.ld.modules
  const [open, setOpen] = useState<string | null>(mods.find((m: any) => !done.includes(m.id))?.id || mods[0].id)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const pct = Math.round((done.length / mods.length) * 100)
  const { busy, run } = useAction()
  const toggle = (mid: string) => run(async () => {
    await api(`/ld/${p.id}/toggle`, { body: { module_id: mid } })
    invalidate('/c/ld_progress')
    const nowDone = !done.includes(mid)
    if (nowDone && done.length + 1 === mods.length) toast(`Learning for ${p.name} completed`)
    if (nowDone) setOpen(mods.find((m: any) => m.id !== mid && !done.includes(m.id))?.id || null)
  }, 'Couldn’t save your progress')
  return (
    <Drawer wide scrim={false} onClose={onClose} title="Learning" sub={`${p.name} · set by ${p.product_manager.name}`}>
      <div className="spread small" style={{ marginBottom: 6 }}><span className="strong">{done.length} of {mods.length} steps</span><span className="num">{pct}%</span></div>
      <Bar v={pct} />
      <ol className="ld-steps">
        {mods.map((m: any, i: number) => {
          const Icon = MOD_ICON[m.type] || BookOpen
          const isDone = done.includes(m.id)
          const quizOk = m.type !== 'quiz' || (m.questions || []).every((q: any, qi: number) => answers[qi] === q.answer)
          return (
            <li key={m.id} className={`ld-step ${isDone ? 'done' : ''} ${open === m.id ? 'open' : ''}`}>
              <button className="ld-step-head" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
                <span className="ld-num">{isDone ? <Check size={13} /> : i + 1}</span>
                <span className="grow" style={{ textAlign: 'left' }}><span className="strong small">{m.title}</span><br /><span className="tiny muted row" style={{ gap: 4, display: 'inline-flex' }}><Icon size={12} />{label(m.type)} · {m.minutes} min</span></span>
              </button>
              {open === m.id && (
                <div className="ld-step-body">
                  <p className="small">{m.body}</p>
                  {m.type === 'video' && <div className="video-ph"><PlayCircle size={28} /><span className="small">Video from the product team will play here.</span></div>}
                  {m.type === 'document' && <div className="doc-ph"><FileText size={18} /><span className="small">Fact sheet (PDF) · Key information memorandum (PDF)</span></div>}
                  {m.type === 'quiz' && (m.questions || []).map((q: any, qi: number) => (
                    <fieldset key={qi} className="quiz">
                      <legend className="small strong">{q.q}</legend>
                      {q.options.map((o: string, oi: number) => (
                        <label key={oi} className={`check small quiz-opt ${answers[qi] === oi ? (oi === q.answer ? 'right' : 'wrong') : ''}`}>
                          <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers({ ...answers, [qi]: oi })} />{o}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <button className={`btn btn-sm ${isDone ? 'btn-quiet' : 'btn-primary'}`} disabled={busy || (!isDone && !quizOk)} onClick={() => toggle(m.id)}>
                    {isDone ? 'Mark as not done' : m.type === 'quiz' ? (quizOk ? 'Submit answers' : 'Answer all questions correctly') : 'Mark complete'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </Drawer>
  )
}
