import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Gem, LayoutGrid, Search, User, UserRoundSearch } from 'lucide-react'
import { api } from '../lib/api'
import { hrefFor, useEsc } from '../ui'

const ICON: Record<string, any> = { client: User, prospect: UserRoundSearch, product: Gem, portfolio: LayoutGrid, meeting: CalendarDays }
const QUICK = [
  { kind: 'page', id: '/studio?new=1', title: 'Create a portfolio', sub: 'Portfolio Studio' },
  { kind: 'page', id: '/prospects?new=1', title: 'Add a prospect', sub: 'Prospects' },
  { kind: 'page', id: '/requests?ticket=1', title: 'Raise a ticket', sub: 'Requests' },
  { kind: 'page', id: '/meetings', title: 'Open this week’s calendar', sub: 'Meetings' },
]

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<any[]>([])
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    if (!q.trim()) { setRes([]); return }
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes([])), 120)
    return () => clearTimeout(t)
  }, [q])
  const items = useMemo(() => (q.trim() ? res : QUICK), [q, res])
  useEffect(() => setI(0), [items])
  const go = (it: any) => { onClose(); nav(hrefFor(it)) }
  useEsc(onClose)
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal palette" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault() }}>
        <div className="palette-input">
          <Search size={18} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients, prospects, products, portfolios"
            aria-label="Search" role="combobox" aria-expanded aria-controls="palette-list" aria-activedescendant={items[i] ? `pi-${i}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter' && items[i]) go(items[i])
            }} />
        </div>
        <div className="palette-list" id="palette-list" role="listbox" aria-label="Results">
          {!q.trim() && <div className="tiny muted" style={{ padding: '8px 16px 4px' }}>Jump to</div>}
          {items.map((it, k) => {
            const Icon = ICON[it.kind] || LayoutGrid
            return (
              <button key={it.kind + it.id} id={`pi-${k}`} role="option" aria-selected={k === i} tabIndex={-1} className={`palette-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => go(it)}>
                <Icon size={16} aria-hidden />
                <span className="grow ellipsis">{it.title}</span>
                <span className="tiny muted">{it.sub}</span>
              </button>
            )
          })}
          {q.trim() && !res.length && <div className="empty small">Nothing matches “{q}”.</div>}
        </div>
      </div>
    </>,
    document.body,
  )
}
