import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { date, initials, inr, label } from '../lib/format'

/* ---------- avatar: photo if present, otherwise a monogram */
const TINTS = [['#E3E9E3', '#1D3A2E'], ['#F1E9DA', '#7C6136'], ['#E6E4F0', '#43406B'], ['#E7EEF2', '#2C4E63'], ['#F3E5E0', '#7D3F2B'], ['#EAE7DD', '#4D4A3F']]
export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: TINTS[i][0], color: TINTS[i][1] }} aria-hidden>
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  )
}

/* ---------- a number that says where it came from */
export function Num({ v, src = 'Kova holdings', asOf, compact = true, className = '', children }: { v?: number | null; src?: string; asOf?: string; compact?: boolean; className?: string; children?: ReactNode }) {
  return (
    <span className={`prov num ${className}`} tabIndex={0}>
      {children ?? inr(v, { compact })}
      <span className="tip">{src} · as of {asOf ? date(asOf) : 'today'}</span>
    </span>
  )
}

export function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const up = v >= 0
  return <span className={`delta ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}{suffix}</span>
}

/* ---------- status pills */
const STATUS: Record<string, string> = {
  active: 'gain', engaged: 'forest', dormant: 'warn', lost: 'loss',
  draft: 'outline', awaiting_approval: 'brass', approved: 'gain', changes_requested: 'loss', practice: '', live: 'forest',
  sent: 'outline', in_review: 'brass', done: 'gain', rejected: 'loss', needs_info: 'loss', superseded: 'outline', pending: 'brass',
  scheduled: 'forest', needs_mom: 'brass', completed: 'gain', cancelled: 'outline',
  Preferred: 'gain', Neutral: '', 'Under review': 'warn',
  high: 'loss', normal: 'outline',
}
const STATUS_TEXT: Record<string, string> = { needs_mom: 'Needs MoM', in_review: 'In review', awaiting_approval: 'Awaiting approval', changes_requested: 'Changes requested', needs_info: 'Needs your input' }
export function Status({ s, children }: { s: string; children?: ReactNode }) {
  return <span className={`pill ${STATUS[s] ?? ''}`}><span className="dot" />{children ?? STATUS_TEXT[s] ?? label(s)}</span>
}

/* ---------- panels */
export function Panel({ title, aside, children, className = '', pad = true, id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id}>
      {(title || aside) && (
        <div className="panel-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {aside && <div className="aside">{aside}</div>}
        </div>
      )}
      <div className={pad ? 'panel-body' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label: l, value, sub, large }: { label: string; value: ReactNode; sub?: ReactNode; large?: boolean }) {
  return (
    <div className="stat">
      <span className="label">{l}</span>
      <span className={`value ${large ? 'l' : ''}`}>{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  )
}

export function Bar({ v, brass }: { v: number; brass?: boolean }) {
  return <div className={`bar ${brass ? 'brass' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  )
}

/* ---------- drawer and modal */
function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}
export function Drawer({ title, sub, onClose, children, foot, wide, scrim = true }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean; scrim?: boolean }) {
  useEsc(onClose)
  return createPortal(
    <>
      {scrim && <div className="scrim" onClick={onClose} />}
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </aside>
    </>,
    document.body,
  )
}
export function Modal({ title, sub, onClose, children, foot, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEsc(onClose)
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </div>
    </>,
    document.body,
  )
}

/* ---------- toasts */
type Toast = { id: number; text: ReactNode }
const ToastCtx = createContext<(t: ReactNode) => void>(() => {})
export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: ReactNode) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(<div className="toasts" role="status">{items.map((t) => <div key={t.id} className="toast"><span className="ring" />{t.text}</div>)}</div>, document.body)}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------- links to entities */
export function hrefFor(link?: { kind: string; id: string } | null) {
  if (!link) return '#'
  switch (link.kind) {
    case 'client': return `/clients/${link.id}`
    case 'prospect': return `/prospects/${link.id}`
    case 'product': return `/products/${link.id}`
    case 'portfolio': return `/studio/${link.id}`
    case 'meeting': return `/meetings?m=${link.id}`
    case 'request': return `/requests?r=${link.id}`
    case 'page': return link.id
    default: return '#'
  }
}
export function EntityLink({ link, children, className = '' }: { link?: { kind: string; id: string } | null; children: ReactNode; className?: string }) {
  return <Link to={hrefFor(link)} className={className}>{children}</Link>
}

export function AssetDot({ cls }: { cls: string }) {
  return <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[cls] || '#999' }} />
}
export const ASSET_COLORS: Record<string, string> = { Equity: '#1D3A2E', Debt: '#9A7A47', Gold: '#C9A961', Cash: '#A9B8A9', Alternatives: '#5F7D6E' }
