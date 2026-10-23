import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { useGrowth } from '../lib/data'
import { date, daysFrom, inr, when } from '../lib/format'
import { Columns } from '../charts'
import { Bar, hrefFor, Num, Panel, useToast } from '../ui'

export default function Growth() {
  const { data: g } = useGrowth()
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [showDone, setShowDone] = useState(false)
  const toast = useToast()
  const nav = useNavigate()
  if (!g) return <main className="page"><div className="panel skeleton" style={{ height: 300 }} /></main>

  const op = async (body: any, msg: string) => {
    try { await api('/growth/goals', { body }); invalidate('/s/growth'); toast(msg) } catch (e: any) { toast(e.message) }
  }
  const p = g.points
  const slabs = p.slabs
  const max = slabs[slabs.length - 1].from * 1.15
  const cur = [...slabs].reverse().find((s: any) => p.this_quarter >= s.from)
  const proj = [...slabs].reverse().find((s: any) => p.projected_quarter >= s.from)
  const next = slabs.find((s: any) => s.from > p.this_quarter)
  const daysLeft = daysFrom(g.period.end) ?? 0
  const open = g.goals

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
              {x.progress != null && <div style={{ marginTop: 'auto' }}><Bar v={x.progress * 100} brass /><div className="tiny muted" style={{ marginTop: 4 }}>{Math.round(x.progress * 100)}% there</div></div>}
              <div className="goal-foot">
                <span className="tiny muted">{x.by === 'manager' ? `Set by ${x.set_by}` : 'Yours'}</span>
                <div className="row" style={{ gap: 0 }}>
                  {editing?.id === x.id ? <button className="iconbtn" aria-label="Save" onClick={() => { op({ op: "edit", id: x.id, text: editing!.text }, "Goal updated"); setEditing(null) }}><Check /></button>
                    : x.by !== 'manager' && <button className="iconbtn" aria-label="Edit" onClick={() => setEditing({ id: x.id, text: x.text })}><Pencil /></button>}
                  {x.by !== 'manager' && <button className="iconbtn" aria-label="Remove" onClick={() => op({ op: 'remove', id: x.id }, 'Goal removed')}><Trash2 /></button>}
                  <button className="btn btn-quiet btn-sm" onClick={() => op({ op: 'achieve', id: x.id }, 'Achieved. Well done.')}><Check />Achieved</button>
                </div>
              </div>
            </div>
          ))}
          {open.length < 5 && (
            <div className="goal empty-goal">
              <span className="goal-num display">{open.length + 1}</span>
              <textarea className="textarea" rows={3} placeholder="Write a goal you can tell is done, e.g. “Get Sunita Desai investing again”" value={adding} onChange={(e) => setAdding(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={!adding.trim()} onClick={() => { op({ op: 'add', text: adding }, 'Goal added'); setAdding('') }}><Plus />Add goal</button>
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
          <div className="slab-track">
            {slabs.map((s: any, i: number) => (
              <div key={s.name} className="slab" style={{ left: `${(s.from / max) * 100}%`, width: `${(((slabs[i + 1]?.from ?? max) - s.from) / max) * 100}%` }}>
                <span className="tiny">{s.name}</span><span className="tiny muted">{s.from}+</span>
              </div>
            ))}
            <div className="slab-fill" style={{ width: `${(p.this_quarter / max) * 100}%` }} />
            <div className="slab-proj" style={{ left: `${(p.this_quarter / max) * 100}%`, width: `${((p.projected_quarter - p.this_quarter) / max) * 100}%` }} />
            <div className="slab-me" style={{ left: `${(p.this_quarter / max) * 100}%` }}><span className="ring lg" /></div>
          </div>
          <p className="small" style={{ marginTop: 34 }}>
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
              <div key={i} className="suggest-item"><span className="ring" style={{ marginTop: 5 }} /><p className="grow small">{s.text}</p><button className="iconbtn" aria-label="Open" onClick={() => nav(hrefFor(s.link))}><ArrowRight /></button></div>
            ))}
          </div>
          <div className="guardrail"><ShieldCheck size={15} /><span className="tiny">{g.guardrail}</span></div>
        </Panel>
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>Contests you’re in</h2>
      <div className="grid g3">
        {g.contests.map((c: any) => (
          <section key={c.id} className="panel panel-pad contest">
            <div className="spread"><h3>{c.name}</h3><span className="pill brass">Ends {when(c.ends)}</span></div>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>{c.rule}. Prize: {c.prize}.</p>
            <div className="display" style={{ fontSize: 30, color: 'var(--ink-strong)' }}>#{c.my_rank}</div>
            <div className="col" style={{ gap: 4, marginTop: 10 }}>
              {c.leaderboard.map((r: any, i: number) => (
                <div key={r.name} className={`spread small lb ${r.me ? 'me' : ''}`}><span>{i + 1}. {r.name}</span><span className="num">{r.value > 1000 ? inr(r.value) : r.value}</span></div>
              ))}
            </div>
            <p className="tiny faint" style={{ marginTop: 10 }}>Everyone eligible is entered automatically.</p>
          </section>
        ))}
      </div>
    </main>
  )
}
