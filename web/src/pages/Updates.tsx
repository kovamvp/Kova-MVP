import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Building2, CalendarDays, Check, CircleDollarSign, Clock3, Flag, Gift, Inbox, ListTodo, Sparkles, Undo2, UserRound } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { useAction } from '../lib/action'
import { useUpdates } from '../lib/data'
import { daysFrom, nowISO, when } from '../lib/format'
import { hrefFor, useEsc, useToast } from '../ui'

const KIND: Record<string, { icon: any; label: string }> = {
  meeting: { icon: CalendarDays, label: 'Meeting' }, approval: { icon: Inbox, label: 'Approval' }, nudge: { icon: Sparkles, label: 'Nudge' },
  client: { icon: UserRound, label: 'Client signal' }, company: { icon: Building2, label: 'From the firm' }, contest: { icon: Flag, label: 'Contest' },
  deadline: { icon: AlarmClock, label: 'Deadline' }, cash: { icon: CircleDollarSign, label: 'Cash flow' }, personal: { icon: Gift, label: 'Personal' },
  task: { icon: ListTodo, label: 'Task' },
}

function snoozeTimes() {
  const d = new Date()
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
  const hour = new Date(d.getTime() + 3600e3)
  const tom = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 30)
  const wk = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((8 - d.getDay()) % 7 || 7), 9, 30)
  return [{ l: 'In an hour', v: iso(hour) }, { l: 'Tomorrow, 9:30 am', v: iso(tom) }, { l: 'Next Monday', v: iso(wk) }]
}

/* Fixed panel: everything that needs the RM, ranked by priority and deadline. Not movable, not removable. */
export default function Updates() {
  const { data: updates = [] } = useUpdates()
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const toast = useToast()
  const { run } = useAction()
  const now = nowISO()
  const { live, done, snoozed } = useMemo(() => {
    const live = updates.filter((u) => !u.done && !(u.snoozed_until && u.snoozed_until > now))
    const rank = (u: any) => {
      const d = u.due ? daysFrom(u.due)! : 99
      return u.priority * 10 + Math.max(-5, Math.min(d, 30)) * 0.5
    }
    live.sort((a, b) => rank(a) - rank(b))
    return { live, done: updates.filter((u) => u.done), snoozed: updates.filter((u) => !u.done && u.snoozed_until && u.snoozed_until > now) }
  }, [updates, now])
  const groups = [
    { name: 'Needs you now', items: live.filter((u) => u.priority <= 1 || (u.due && daysFrom(u.due)! <= 0)) },
    { name: 'Coming up', items: live.filter((u) => !(u.priority <= 1 || (u.due && daysFrom(u.due)! <= 0)) && u.kind !== 'company') },
    { name: 'From the firm', items: live.filter((u) => u.kind === 'company' && !(u.priority <= 1)) },
  ]
  const markDone = (u: any) => run(async () => {
    await api(`/updates/${u.id}/done`, { method: 'POST' })
    invalidate('/c/updates')
    toast(u.done ? 'Moved back to your list' : <>Marked done. <button className="toast-undo" onClick={() => markDone({ ...u, done: true })}>Undo</button></>)
  }, u.done ? 'Couldn’t move it back' : 'Couldn’t mark it done')
  const snooze = (u: any, until: string, l: string) => {
    setSnoozeFor(null)
    run(async () => {
      await api(`/updates/${u.id}/snooze`, { body: { until } })
      invalidate('/c/updates')
      toast(`Snoozed until ${l.toLowerCase()}`)
    }, 'Couldn’t snooze it')
  }
  /* The panel always ends above the dock, whether the page is scrolled or not, and says when there is more below */
  const box = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current
      if (!el) return
      const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-space')) || 104
      const top = Math.max(el.getBoundingClientRect().top, 76)
      el.style.maxHeight = `${Math.max(320, window.innerHeight - top - dock - 8)}px`
    }
    fit()
    window.addEventListener('scroll', fit, { passive: true })
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('scroll', fit); window.removeEventListener('resize', fit) }
  }, [])
  useEffect(() => {
    const b = body.current
    if (!b) return
    const check = () => setMore(b.scrollHeight - b.scrollTop - b.clientHeight > 8)
    check()
    b.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check); ro.observe(b)
    return () => { b.removeEventListener('scroll', check); ro.disconnect() }
  }, [updates.length])
  return (
    <aside className="updates" ref={box} aria-label="Updates and upcoming">
      <div className="updates-head">
        <div>
          <h2>Updates &amp; upcoming</h2>
          <div className="tiny muted">{live.length} open · ranked by priority and deadline</div>
        </div>
      </div>
      <div className={`updates-body ${more ? 'has-more' : ''}`} ref={body}>
        {groups.map((g) => g.items.length > 0 && (
          <div key={g.name} className="u-group">
            <div className="u-group-name">{g.name}</div>
            {g.items.map((u) => {
              const K = KIND[u.kind] || KIND.task
              const overdue = u.due && daysFrom(u.due)! < 0
              return (
                <div key={u.id} className={`u-item p${u.priority}`}>
                  <span className="u-icon"><K.icon /></span>
                  <Link to={hrefFor(u.link)} className="grow" style={{ minWidth: 0 }}>
                    <div className="u-title">{u.title}</div>
                    <div className="tiny muted">{u.body}</div>
                    <div className="tiny u-meta">
                      {u.due && <span className={overdue ? 'u-overdue' : ''}><Clock3 size={11} aria-hidden /> {overdue ? 'Overdue · ' : ''}{when(u.due)}</span>}
                      <span className="u-source">{u.source}</span>
                    </div>
                  </Link>
                  <div className="u-actions">
                    <button className="iconbtn" title="Mark done" aria-label="Mark done" onClick={() => markDone(u)}><Check aria-hidden /></button>
                    <button className="iconbtn" title="Snooze" aria-label="Snooze" aria-expanded={snoozeFor === u.id} onClick={() => setSnoozeFor(snoozeFor === u.id ? null : u.id)}><AlarmClock aria-hidden /></button>
                    {snoozeFor === u.id && (
                      <SnoozeMenu onClose={() => setSnoozeFor(null)} onPick={(v, l) => snooze(u, v, l)} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {live.length === 0 && <div className="empty small">You’re clear. New items appear here as they arrive from across Kova.</div>}
        {(done.length > 0 || snoozed.length > 0) && (
          <div className="u-footer">
            <button className="linkbtn tiny" onClick={() => setShowDone((s) => !s)}>{showDone ? 'Hide' : 'Show'} {done.length} done · {snoozed.length} snoozed</button>
            {showDone && [...snoozed, ...done].map((u) => (
              <div key={u.id} className="row tiny" style={{ padding: '6px 0', gap: 8 }}>
                <span className="grow ellipsis muted" style={{ textDecoration: u.done ? 'line-through' : 'none' }}>{u.title}</span>
                {u.done
                  ? <button className="iconbtn" title="Undo" aria-label="Undo" onClick={() => markDone(u)}><Undo2 /></button>
                  : <span className="faint">until {when(u.snoozed_until)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {more && <div className="u-more tiny" aria-hidden>{live.length} open · scroll for more</div>}
    </aside>
  )
}

function SnoozeMenu({ onClose, onPick }: { onClose: () => void; onPick: (v: string, l: string) => void }) {
  useEsc(onClose)
  return (
    <div className="u-snooze" role="group" aria-label="Snooze until">
      {snoozeTimes().map((s, i) => <button key={s.l} autoFocus={i === 0} onClick={() => onPick(s.v, s.l)}>{s.l}</button>)}
    </div>
  )
}
