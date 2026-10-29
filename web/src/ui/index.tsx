import { Component, createContext, CSSProperties, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { RotateCcw, Search, X } from 'lucide-react'
import { date, groupIN, initials, inr, label, parseAmount } from '../lib/format'

/* ---------- avatar: photo if present, otherwise a monogram */
const TINTS = [['#E3E9E3', '#1D3A2E'], ['#F1E9DA', '#7C6136'], ['#E6E4F0', '#43406B'], ['#E7EEF2', '#2C4E63'], ['#F3E5E0', '#7D3F2B'], ['#EAE7DD', '#4D4A3F']]
export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: TINTS[i][0], color: TINTS[i][1] }} aria-hidden>
      {photo ? <img src={photo} alt="" width={size} height={size} /> : initials(name)}
    </span>
  )
}

/* ---------- a number that says where it came from.
   Only headline figures (inside <Stat>) are keyboard stops; numbers inside rows and links are not,
   so the RM doesn't have to tab through every figure on a list. */
const StatCtx = createContext(false)
export function Num({ v, src = 'Kova holdings', asOf, compact = true, fixed = false, className = '', children }: { v?: number | null; src?: string; asOf?: string; compact?: boolean; fixed?: boolean; className?: string; children?: ReactNode }) {
  const focusable = useContext(StatCtx)
  return (
    <span className={`prov num ${className}`} tabIndex={focusable ? 0 : undefined}>
      {children ?? inr(v, { compact, fixed })}
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
  draft: 'outline', awaiting_approval: '', approved: 'gain', changes_requested: 'attn', practice: '', live: 'forest',
  sent: 'outline', in_review: '', done: 'gain', rejected: 'outline', needs_info: 'attn', superseded: 'outline', pending: '',
  scheduled: 'forest', needs_mom: 'brass', completed: 'gain', cancelled: 'outline', no_show: 'outline',
  Preferred: 'gain', Neutral: '', 'Under review': 'warn',
  high: 'outline', normal: 'outline',
}
const STATUS_TEXT: Record<string, string> = { needs_mom: 'Needs MoM', in_review: 'In review', awaiting_approval: 'Awaiting approval', changes_requested: 'Changes requested', needs_info: 'Needs your input', no_show: 'Didn’t attend' }
export function Status({ s, children }: { s?: string | null; children?: ReactNode }) {
  if (!s && !children) return null
  const k = s || ''
  return <span className={`pill ${STATUS[k] ?? ''}`}><span className="dot" />{children ?? STATUS_TEXT[k] ?? label(k)}</span>
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
    <StatCtx.Provider value>
      <div className="stat">
        <span className="label">{l}</span>
        <span className={`value ${large ? 'l' : ''}`}>{value}</span>
        {sub && <span className="sub">{sub}</span>}
      </div>
    </StatCtx.Provider>
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

/* ---------- one search field for every list toolbar: labelled, with a visible focus state */
export function SearchField({ value, onChange, placeholder, label: name, height = 34, width, style }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; height?: number; width?: number | string; style?: CSSProperties }) {
  return (
    <label className="searchbox field-search" style={{ height, maxWidth: width, ...style }}>
      <Search size={height < 34 ? 13 : 14} aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={name} autoComplete="off" spellCheck={false} />
    </label>
  )
}

/* ---------- loading and error states, drawn in the final layout */
export function SkeletonRows({ rows = 5, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-row" style={{ height }}>
          <span className="sk sk-circle" />
          <span className="grow col" style={{ gap: 8 }}><span className="sk" style={{ width: '38%' }} /><span className="sk" style={{ width: '24%', height: 8 }} /></span>
          <span className="sk" style={{ width: 90 }} />
        </div>
      ))}
    </div>
  )
}
export function DetailSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <span className="sk" style={{ width: 80, height: 10, marginBottom: 18, display: 'block' }} />
      <section className="panel" style={{ padding: '22px 24px', marginBottom: 16 }}>
        <div className="row" style={{ gap: 18 }}><span className="sk sk-circle" style={{ width: 68, height: 68 }} /><span className="grow col" style={{ gap: 10 }}><span className="sk" style={{ width: '32%', height: 22 }} /><span className="sk" style={{ width: '55%' }} /></span><span className="sk" style={{ width: 140, height: 28 }} /></div>
      </section>
      <div className="grid g-main-wide">
        <section className="panel" style={{ height: 320, padding: 20 }}><span className="sk" style={{ width: '20%', height: 14 }} /></section>
        <section className="panel" style={{ height: 320, padding: 20 }}><span className="sk" style={{ width: '40%', height: 14 }} /></section>
      </div>
    </main>
  )
}
export function LoadError({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div className="load-error" role="alert">
      <span>Couldn’t load {what}. Check your connection.</span>
      {onRetry && <button className="linkbtn" onClick={onRetry}><RotateCcw size={13} />Retry</button>}
    </div>
  )
}

/* ---------- a render error in one page should not blank the whole app */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) { console.error('[Kova Work] page error', err) }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <main className="page">
        <Empty title="This page hit a problem" action={<button className="btn btn-quiet" onClick={() => window.location.reload()}><RotateCcw />Reload the page</button>}>
          Nothing you saved was lost. Reload, or use the dock to open another page.
        </Empty>
      </main>
    )
  }
}

/* ---------- drawer and modal: focus moves in on open, Tab stays inside a modal, focus returns on close */
/* Escape closes only the top-most layer (a modal opened over a drawer closes first). */
const escStack: { current: () => void }[] = []
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !escStack.length) return
    e.preventDefault()
    escStack[escStack.length - 1].current()
  })
}
export function useEsc(onClose: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    const entry = ref
    escStack.push(entry)
    return () => { const i = escStack.indexOf(entry); if (i >= 0) escStack.splice(i, 1) }
  }, [])
}
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
function useDialogFocus(trap: boolean) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = ref.current
    if (el) {
      const auto = el.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
      ;(auto || el).focus({ preventScroll: true })
    }
    const onKey = (e: KeyboardEvent) => {
      if (!trap || e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null)
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (!ref.current.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [trap])
  return ref
}
function DialogHead({ id, title, sub, onClose }: { id: string; title: ReactNode; sub?: ReactNode; onClose: () => void }) {
  return (
    <div className="drawer-head">
      <div className="grow" id={id}>
        {typeof title === 'string' ? <h2>{title}</h2> : title}
        {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      <button className="iconbtn" onClick={onClose} aria-label="Close panel"><X /></button>
    </div>
  )
}
export function Drawer({ title, sub, onClose, children, foot, wide, scrim = true }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean; scrim?: boolean }) {
  useEsc(onClose)
  const id = useId()
  const ref = useDialogFocus(scrim)
  /* A side panel (no scrim) tells the page it is open, so the floating context bar can re-centre in the
     space that is left and the agent orb is never hidden behind the panel. */
  useEffect(() => {
    if (scrim) return
    const b = document.body
    b.classList.add('panel-open')
    b.classList.toggle('panel-wide', !!wide)
    return () => { b.classList.remove('panel-open', 'panel-wide') }
  }, [scrim, wide])
  return createPortal(
    <>
      {scrim && <div className="scrim" onClick={onClose} />}
      <aside ref={ref} tabIndex={-1} className={`drawer ${wide ? 'wide' : ''} ${scrim ? '' : 'side-panel'}`} role="dialog" aria-modal={scrim ? true : undefined} aria-labelledby={id}>
        <DialogHead id={id} title={title} sub={sub} onClose={onClose} />
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </aside>
    </>,
    document.body,
  )
}
export function Modal({ title, sub, onClose, children, foot, wide }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEsc(onClose)
  const id = useId()
  const ref = useDialogFocus(true)
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref as any} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <DialogHead id={id} title={title} sub={sub} onClose={onClose} />
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
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(<div className="toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className="toast"><span className="ring" />{t.text}</div>)}</div>, document.body)}
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
export const ASSET_COLORS: Record<string, string> = { Equity: '#1D3A2E', Debt: '#848C70', Gold: '#C9A961', Cash: '#A9B8A9', Alternatives: '#5F7D6E' }

/* ---------- amount input: Indian digit grouping (75,00,000) so a missing zero is visible; shows the compact value below */
export function AmountInput({ value, onChange, disabled, label: name, className = '', echo = true, width }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string; className?: string; echo?: boolean; width?: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <span className="amount-input" style={{ width }}>
      <input className={`input num ${className}`} inputMode="numeric" autoComplete="off" aria-label={name} disabled={disabled}
        value={draft ?? groupIN(value)}
        onFocus={() => setDraft(groupIN(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => { const raw = e.target.value.replace(/[^0-9,]/g, ''); setDraft(raw); onChange(parseAmount(raw)) }} />
      {echo && <span className="tiny muted amount-echo">{value ? inr(value) : '₹0'}</span>}
    </span>
  )
}
