import { useEffect, useMemo, useRef, useState } from 'react'
import ReactGridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { GripVertical, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { api } from '../lib/api'
import { useClients, useGrowth, useLd, useMeetings, usePortfolios, useProducts, useProspects, useRequests, useResearch, useRm } from '../lib/data'
import { todayISO, when } from '../lib/format'
import { Avatar, Modal, useToast, SearchField } from '../ui'
import { Ctx, DEFAULT_LAYOUT, PickKind, WIDGET, WIDGETS } from '../widgets/registry'
import Updates from './Updates'

const Grid = WidthProvider(ReactGridLayout)
type Item = { i: string; type: string; ref?: string; x: number; y: number; w: number; h: number }
const LAYOUT_ID = 'RM-0042'

export default function Home() {
  const { data: rm } = useRm()
  const ctxData = {
    clients: useClients().data, prospects: useProspects().data, products: useProducts().data, portfolios: usePortfolios().data,
    meetings: useMeetings().data, requests: useRequests().data, growth: useGrowth().data, ld: useLd().data, research: useResearch().data,
  }
  const ready = Object.values(ctxData).every((v) => v !== undefined)
  const ctx = ctxData as Ctx

  const [items, setItems] = useState<Item[] | null>(null)
  const [edit, setEdit] = useState(false)
  const [dragType, setDragType] = useState<string | null>(null)
  const [picking, setPicking] = useState<{ type: string; at?: { x: number; y: number } } | null>(null)
  const [libQuery, setLibQuery] = useState('')
  const toast = useToast()
  const saveT = useRef<number>(0)

  useEffect(() => {
    api(`/c/layouts/${LAYOUT_ID}`).then((d: any) => setItems(d.items)).catch(() => setItems(DEFAULT_LAYOUT))
  }, [])
  const persist = (next: Item[]) => {
    window.clearTimeout(saveT.current)
    saveT.current = window.setTimeout(() => api(`/c/layouts/${LAYOUT_ID}`, { method: 'PUT', body: { items: next } }).catch(() => toast('Couldn’t save your layout. Check your connection.')), 500)
  }
  const update = (next: Item[]) => { setItems(next); persist(next) }

  const add = (type: string, ref?: string, at?: { x: number; y: number }) => {
    const def = WIDGET[type]
    const maxY = Math.max(0, ...(items || []).map((it) => it.y + it.h))
    const it: Item = { i: `w-${type}-${Date.now().toString(36)}`, type, ref, x: at?.x ?? 0, y: at?.y ?? maxY, w: def.w, h: def.h }
    update([...(items || []), it])
    toast(`${def.name} added`)
  }
  const place = (type: string, at?: { x: number; y: number }) => (WIDGET[type].pick ? setPicking({ type, at }) : add(type, undefined, at))

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const summary = useMemo(() => {
    if (!ready) return ''
    const t = todayISO()
    const mt = ctx.meetings.filter((m) => m.start.slice(0, 10) === t && m.status === 'scheduled').length
    const me = ctx.requests.filter((r) => r.direction === 'waiting_on_me').length
    const mom = ctx.meetings.filter((m) => m.status === 'needs_mom').length
    return [mt ? `${mt} meeting${mt > 1 ? 's' : ''} today` : 'No meetings today', me ? `${me} request${me > 1 ? 's' : ''} waiting on you` : null, mom ? `${mom} MoM${mom > 1 ? 's' : ''} to write` : null].filter(Boolean).join(' · ')
  }, [ready, ctx])

  const lib = WIDGETS.filter((w) => !libQuery || (w.name + w.desc).toLowerCase().includes(libQuery.toLowerCase()))

  return (
    <main className="page home">
      <div className="page-head">
        <div>
          <h1>{greet}, {rm?.name?.split(' ')[0] || 'Priya'}</h1>
          <p className="lede">{summary || 'Loading your day…'}</p>
        </div>
        <div className="row">
          {edit ? (
            <>
              <button className="btn btn-ghost" onClick={() => { const prev = items; update(DEFAULT_LAYOUT); toast(<>Back to the default layout. <button className="toast-undo" onClick={() => prev && update(prev)}>Undo</button></>) }}><RotateCcw />Reset to default</button>
              <button className="btn btn-primary" onClick={() => setEdit(false)}>Done</button>
            </>
          ) : (
            <button className="btn btn-quiet" onClick={() => setEdit(true)}><SlidersHorizontal />Customise</button>
          )}
        </div>
      </div>

      <div className={`home-grid ${edit ? 'editing' : ''}`}>
        {edit && (
          <aside className="library" aria-label="Widget library">
            <div className="library-head">
              <h3>Widgets</h3>
              <p className="tiny muted">Drag onto your board, or click to add. Cards marked “pick” can be placed many times, once per client, product or portfolio. Updates &amp; upcoming stays fixed and returns when you’re done.</p>
              <SearchField value={libQuery} onChange={setLibQuery} placeholder="Find a widget…" label="Find a widget" style={{ marginTop: 10 }} />
            </div>
            <div className="library-list">
              {lib.map((w) => (
                <div key={w.type} className="lib-item" draggable unselectable="on"
                  onDragStart={(e) => { setDragType(w.type); e.dataTransfer.setData('text/plain', w.type) }}
                  onDragEnd={() => setDragType(null)}>
                  <span className="lib-icon"><w.icon /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="small strong" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{w.name}{w.pick && <span className="pill outline" style={{ height: 18 }}>pick</span>}</span>
                    <span className="tiny muted">{w.desc}</span>
                  </span>
                  <button className="iconbtn" aria-label={`Add ${w.name}`} onClick={() => place(w.type)}><Plus /></button>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="board">
          {!ready || !items ? (
            <div className="grid g3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="panel skeleton" style={{ height: 230 }} />)}</div>
          ) : (
            <Grid
              className="layout"
              layout={items.map(({ i, x, y, w, h, type }) => ({ i, x, y, w, h, minW: WIDGET[type]?.minW ?? 3, minH: WIDGET[type]?.minH ?? 2 }))}
              cols={12}
              rowHeight={52}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              isDraggable={edit}
              isResizable={edit}
              isDroppable={edit}
              draggableHandle=".w-drag"
              droppingItem={dragType ? { i: '__drop__', x: 0, y: 0, w: WIDGET[dragType].w, h: WIDGET[dragType].h } : undefined}
              onDrop={(_l: any, item: any) => { if (dragType && item) place(dragType, { x: item.x, y: item.y }); setDragType(null) }}
              onLayoutChange={(l: readonly any[]) => {
                if (!edit) return
                const next = items.map((it) => { const p = l.find((x) => x.i === it.i); return p ? { ...it, x: p.x, y: p.y, w: p.w, h: p.h } : it })
                if (JSON.stringify(next) !== JSON.stringify(items)) update(next)
              }}
            >
              {items.filter((it) => WIDGET[it.type]).map((it) => (
                <div key={it.i} className={`widget panel ${edit ? 'is-edit' : ''}`}>
                  {edit && (
                    <div className="w-edit">
                      <span className="w-drag" title="Drag to move" aria-hidden><GripVertical size={15} /></span>
                      <button className="iconbtn" aria-label={`Remove ${WIDGET[it.type].name}`} onClick={() => { const prev = items; update(items.filter((x) => x.i !== it.i)); toast(<>{WIDGET[it.type].name} removed. <button className="toast-undo" onClick={() => update(prev)}>Undo</button></>) }}><X aria-hidden /></button>
                    </div>
                  )}
                  <div className="w-body">{WIDGET[it.type].render(ctx, it.ref)}</div>
                </div>
              ))}
            </Grid>
          )}
          {edit && <div className="drop-hint tiny muted">Drag the grip to move a widget, the corner to resize it. Changes save as you go.</div>}
        </div>

        {!edit && <Updates />}
      </div>

      {picking && ready && <PickModal kind={WIDGET[picking.type].pick!} ctx={ctx} onClose={() => setPicking(null)} onPick={(ref) => { add(picking.type, ref, picking.at); setPicking(null) }} />}
    </main>
  )
}

function PickModal({ kind, ctx, onClose, onPick }: { kind: PickKind; ctx: Ctx; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const options: { id: string; title: string; sub: string }[] = useMemo(() => {
    switch (kind) {
      case 'client': return ctx.clients.map((c) => ({ id: c.id, title: c.name, sub: `${c.risk_profile} · ${c.segment}` }))
      case 'prospect': return ctx.prospects.filter((p) => p.stage !== 'Closed').map((p) => ({ id: p.id, title: p.name, sub: p.stage }))
      case 'product': return ctx.products.map((p) => ({ id: p.id, title: p.name, sub: p.sub_category }))
      case 'portfolio': return ctx.portfolios.map((p) => ({ id: p.id, title: p.name, sub: `${p.id} · ${p.status.replace(/_/g, ' ')}` }))
      case 'meeting': return ctx.meetings.filter((m) => m.status !== 'cancelled').sort((a, b) => b.start.localeCompare(a.start)).map((m) => ({ id: m.id, title: m.title, sub: when(m.start) }))
      case 'goal': return (ctx.growth.goals || []).map((g: any) => ({ id: g.id, title: g.text, sub: g.by === 'manager' ? 'Manager goal' : 'Your goal' }))
      case 'contest': return (ctx.growth.contests || []).map((c: any) => ({ id: c.id, title: c.name, sub: `Ends ${when(c.ends)}` }))
      case 'request': return ctx.requests.filter((r) => r.direction !== 'completed').map((r) => ({ id: r.id, title: r.title, sub: `${r.id} · ${r.team}` }))
    }
  }, [kind, ctx])
  const list = options.filter((o) => (o.title + o.sub).toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal title={`Pick a ${kind}`} sub="The widget shows the latest data for what you pick." onClose={onClose}>
      <input className="input" autoFocus placeholder={`Search ${kind}s`} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="col" style={{ gap: 0, margin: '0 -20px' }}>
        {list.map((o) => (
          <button key={o.id} className="list-row" style={{ textAlign: 'left' }} onClick={() => onPick(o.id)}>
            {['client', 'prospect'].includes(kind) && <Avatar name={o.title} size={30} />}
            <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: 'block' }}>{o.title}</span><span className="tiny muted">{o.sub}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
