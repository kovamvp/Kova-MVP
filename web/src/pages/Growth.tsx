import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { deferred, useAction } from '../lib/action'
import { useGrowth } from '../lib/data'
import { date, daysFrom, inr, when } from '../lib/format'
import { Columns } from '../charts'
import { Bar, DetailSkeleton, hrefFor, Num, Panel, useEsc, useToast } from '../ui'

export default function Growth() {
  const { data: g } = useGrowth()
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [showDone, setShowDone] = useState(false)
  const toast = useToast()
  const nav = useNavigate()
  const { busy, run } = useAction()
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  if (!g) return <DetailSkeleton />

  const op = (body: any, msg: string) => run(async () => { await api('/growth/goals', { body }); invalidate('/s/growth'); toast(msg) }, 'Couldn’t update your goals')
  const remove = (x: any) => {
    setRemoving((s) => new Set(s).add(x.id))
    const unset = () => setRemoving((s) => { const n = new Set(s); n.delete(x.id); return n })
    const cancel = deferred(async () => {
      try { await api('/growth/goals', { body: { op: 'remove', id: x.id } }); invalidate('/s/growth') } catch (e: any) { toast(`Couldn’t remove the goal. ${e.message}`) } finally { unset() }
    })
    toast(<>Goal removed. <button className="toast-undo" onClick={() => { cancel(); unset() }}>Undo</button></>)
  }
  const p = g.points
  const slabs = p.slabs
  const max = slabs[slabs.length - 1].from * 1.15
  const cur = [...slabs].reverse().find((s: any) => p.this_quarter >= s.from)
  const proj = [...slabs].reverse().find((s: any) => p.projected_quarter >= s.from)
  const next = slabs.find((s: any) => s.from > p.this_quarter)
  const daysLeft = daysFrom(g.period.end) ?? 0
  const open = g.goals.filter((x: any) => !removing.has(x.id))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Growth</h1>
          <p className="lede">{g.period.name} · {daysLeft} days left in the quarter.</p>
        </div>
      </div>

      <section className="goals panel">
        <div className="spread" style={{ padding: '18px 20px 4px' }}>
          <h2>Your five goals</h2>
          <span className="small muted">{open.length} of 5 set · {g.achieved_goals?.length || 0} achieved</span>
        </div>
        <div className="goal-row">
          {open.map((x: any, i: number) => (
            <div key={x.id} className={`goal ${x.by === 'manager' ? 'mgr' : ''}`}>
              <span className="goal-num display">{i + 1}</span>
              {editing?.id === x.id ? (
                <textarea className="textarea" rows={3} autoFocus value={editing!.text} onChange={(e) => setEditing({ id: x.id, text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); op({ op: "edit", id: x.id, text: editing!.text }, "Goal updated"); setEditing(null) } }} />
              ) : <p className="goal-text">{x.text}</p>}
              {x.progress != null && <div style={{ marginTop: 'auto' }}><Bar v={x.progress * 100} /><div className="tiny muted" style={{ marginTop: 4 }}>{Math.round(x.progress * 100)}% there</div></div>}
              <div className="goal-foot">
                <span className="tiny muted">{x.by === 'manager' ? `Set by ${x.set_by}` : 'Yours'}</span>
                <div className="row" style={{ gap: 2 }}>
                  {editing?.id === x.id ? <button className="btn btn-quiet btn-sm" onClick={() => { op({ op: "edit", id: x.id, text: editing!.text }, "Goal updated"); setEditing(null) }}><Check />Save</button> : <>
                    <button className="btn btn-ghost btn-sm goal-achieve" disabled={busy} onClick={() => op({ op: 'achieve', id: x.id }, 'Achieved. Well done.')}><Check />Achieved</button>
                    {x.by !== 'manager' && <GoalMenu n={i + 1} onEdit={() => setEditing({ id: x.id, text: x.text })} onRemove={() => remove(x)} />}
                  </>}
                </div>
              </div>
            </div>
          ))}
          {open.length < 5 && (
            <div className="goal empty-goal">
              <span className="goal-num display">{open.length + 1}</span>
              <textarea className="textarea" rows={3} placeholder="Write a goal you can tell is done, e.g. “Get Sunita Desai investing again”" value={adding} onChange={(e) => setAdding(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!adding.trim() || busy} onClick={async () => { await op({ op: 'add', text: adding }, 'Goal added'); setAdding('') }}><Plus />Add goal</button>
            </div>
          )}
        </div>
        {g.achieved_goals?.length > 0 && (
          <div style={{ padding: '0 20px 16px' }}>
            <button className="linkbtn small" onClick={() => setShowDone((s) => !s)}>{showDone ? 'Hide' : 'Show'} achieved goals</button>
            {showDone && g.achieved_goals.map((a: any) => <div key={a.id} className="small w-line"><Check size={14} color="var(--gain)" /><span className="grow">{a.text}</span><span className="tiny muted">{date(a.achieved_on)}</span></div>)}
          </div>
        )}
      </section>

      <div className="grid g-main" style={{ marginTop: 16 }}>
        <Panel title="Points and slab" aside={`Totals and slabs only · ${p.payout_basis}`}>
          <div className="row" style={{ gap: 28, alignItems: 'flex-end', marginBottom: 18 }}>
            <div className="stat"><span className="label">This quarter</span><span className="value l">{p.this_quarter}<span className="small muted"> pts</span></span><span className="sub">{cur?.name} slab · {cur?.payout_pct}% of variable pay</span></div>
            <div className="stat"><span className="label">Projected at your pace</span><span className="value">{p.projected_quarter}</span><span className="sub">{proj?.name} slab</span></div>
            <div className="stat"><span className="label">Projected payout</span><span className="value"><Num v={p.projected_payout} src="Projection, not final" /></span><span className="sub">Final after compliance checks</span></div>
          </div>
          <div className="slab-track" role="img" aria-label={`${p.this_quarter} points now, ${cur?.name} slab. Projected ${p.projected_quarter} by ${date(g.period.end)}, ${proj?.name} slab.`}>
            <div className="slab-fill" style={{ width: `${(p.this_quarter / max) * 100}%` }} />
            {p.projected_quarter > p.this_quarter && <div className="slab-proj" style={{ left: `${(p.this_quarter / max) * 100}%`, width: `${((p.projected_quarter - p.this_quarter) / max) * 100}%` }} />}
            {p.projected_quarter > p.this_quarter && <span className="slab-proj-label tiny" style={{ left: `${(p.projected_quarter / max) * 100}%` }}>{p.projected_quarter} by {date(g.period.end)}</span>}
            <div className="slab-me" style={{ left: `${(p.this_quarter / max) * 100}%` }}><span className="ring lg" /></div>
            {slabs.map((s: any) => (
              <div key={s.name} className="slab" style={{ left: `${(s.from / max) * 100}%` }}>
                <span className="tiny strong">{s.name}</span><span className="tiny muted">{s.from}+ · {s.payout_pct}%</span>
              </div>
            ))}
          </div>
          <p className="small" style={{ marginTop: 58 }}>
            {next ? <>You’re {next.from - p.this_quarter} points short of {next.name} today. At your current pace you finish the quarter at about {p.projected_quarter}{proj?.name !== cur?.name ? `, in ${proj?.name}` : `, still in ${cur?.name}`}. The quickest honest route is below.</> : 'You’re in the top slab.'}
          </p>
        </Panel>
        <Panel title="Points by month">
          <Columns data={g.points_history.map((x: any) => ({ label: x.month, value: x.points }))} height={150} />
        </Panel>
      </div>

      <div className="grid g-main" style={{ marginTop: 16 }}>
        <Panel title="What your points are made of" aside="Weights set for your grade">
          <table className="table">
            <thead><tr><th>Measure</th><th className="r">Weight</th><th className="r">Actual</th><th className="r">Target</th><th style={{ width: '32%' }}>Progress</th></tr></thead>
            <tbody>
              {g.kpis.map((k: any) => {
                const f = (v: number) => (k.unit === 'inr' ? inr(v) : k.unit === 'pct' ? `${v}%` : v)
                const pr = (k.actual / k.target) * 100
                return (
                  <tr key={k.name}>
                    <td>{k.name}</td><td className="r num">{k.weight}%</td><td className="r num strong">{f(k.actual)}</td><td className="r num muted">{f(k.target)}</td>
                    <td><div className="row" style={{ gap: 8 }}><div className="grow"><Bar v={pr} /></div><span className="tiny num" style={{ width: 34 }}>{Math.round(pr)}%</span></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="Ways to close the gap">
          <div className="col" style={{ gap: 0 }}>
            {g.suggestions.map((s: any, i: number) => (
              <div key={i} className="suggest-item"><span className="bullet" aria-hidden /><p className="grow small">{s.text}</p><button className="iconbtn" aria-label="Open" onClick={() => nav(hrefFor(s.link))}><ArrowRight /></button></div>
            ))}
          </div>
          <div className="guardrail"><ShieldCheck size={15} /><span className="tiny">{g.guardrail}</span></div>
        </Panel>
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>Contests you’re in</h2>
      <div className="grid g3">
        {g.contests.map((c: any) => (
          <section key={c.id} className="panel panel-pad contest">
            <div className="spread"><h3>{c.name}</h3><span className="pill outline">Ends {when(c.ends)}</span></div>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>{c.rule.replace(/\s*\(count\)/, '')}. Prize: {c.prize}.</p>
            <div className="display" style={{ fontSize: 30, color: 'var(--ink-strong)' }}>#{c.my_rank}</div>
            <div className="col" style={{ gap: 4, marginTop: 10 }}>
              {c.leaderboard.map((r: any, i: number) => (
                <div key={r.name} className={`spread small lb ${r.me ? 'me' : ''}`}><span>{i + 1}. {r.name}</span><span className="num">{contestValue(c, r.value)}</span></div>
              ))}
            </div>
            <p className="tiny faint" style={{ marginTop: 10 }}>Everyone eligible is entered automatically.</p>
          </section>
        ))}
      </div>
    </main>
  )
}

// GR3: counts carry their unit from the rule ("4 new PMS clients"); money is already in rupees
function contestValue(c: any, v: number) {
  if (!/\(count\)/.test(c.rule)) return v > 1000 ? inr(v) : String(v)
  const noun = c.rule.replace(/\s*\(count\)/, '')
  const n = noun.charAt(0).toLowerCase() + noun.slice(1)
  return `${v} ${v === 1 ? n.replace(/s$/, '') : n}`
}

// GR2: edit and remove sit behind a small menu so Achieved is the one visible action on each goal
function GoalMenu({ n, onEdit, onRemove }: { n: number; onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off)
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  const pick = (fn: () => void) => { setOpen(false); fn() }
  const keys = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') || [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
  }
  return (
    <div className="goal-menu" ref={ref}>
      <button className="iconbtn" aria-label={`More actions for goal ${n}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal aria-hidden /></button>
      {open && <MenuEsc onClose={() => { setOpen(false); ref.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus() }} />}
      {open && (
        <div className="goal-menu-list" role="menu" onKeyDown={keys}>
          <button role="menuitem" className="mi" onClick={() => pick(onEdit)}><Pencil aria-hidden />Edit</button>
          <button role="menuitem" className="mi" onClick={() => pick(onRemove)}><Trash2 aria-hidden />Remove</button>
        </div>
      )}
    </div>
  )
}
function MenuEsc({ onClose }: { onClose: () => void }) { useEsc(onClose); return null }
