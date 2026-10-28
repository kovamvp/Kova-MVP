import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, FileJson, Plus, Sparkles, SquarePen, Upload } from 'lucide-react'
import { api, invalidate } from '../lib/api'
import { assetClassOf, useClients, useModels, usePortfolios, useProducts, useProspects } from '../lib/data'
import { ago, inr } from '../lib/format'
import { AllocBar } from '../charts'
import { ASSET_COLORS, Empty, LoadError, Modal, Status, useToast } from '../ui'

const LISTS = [
  { key: 'draft', label: 'Drafts', match: (s: string) => s === 'draft' },
  { key: 'review', label: 'Awaiting approval', match: (s: string) => s === 'awaiting_approval' || s === 'changes_requested' },
  { key: 'approved', label: 'Approved', match: (s: string) => s === 'approved' },
  { key: 'practice', label: 'Practice', match: (s: string) => s === 'practice' },
]

export function allocOf(lines: any[], P: Record<string, any>) {
  const a: Record<string, number> = {}
  lines.forEach((l) => { const c = assetClassOf(P[l.product_id]); a[c] = (a[c] || 0) + l.amount })
  return a
}

export default function Studio() {
  const { data: portfolios = [], loading, error, reload } = usePortfolios()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: prospects = [] } = useProspects()
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState('draft')
  const P = Object.fromEntries(products.map((p) => [p.id, p]))
  const whoName = (tag: any) => (tag ? [...clients, ...prospects].find((x) => x.id === tag.id)?.name : null)
  const creating = params.get('new') === '1'
  const shown = portfolios.filter((p) => LISTS.find((l) => l.key === list)!.match(p.status)).sort((a, b) => b.updated.localeCompare(a.updated))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Portfolio Studio</h1>
          <p className="lede">Build portfolios from the CIO’s models or from scratch, tag a client or prospect, and send them for approval.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}><Plus />Create a portfolio</button>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {LISTS.map((l) => <button key={l.key} className={list === l.key ? 'on' : ''} aria-pressed={list === l.key} onClick={() => setList(l.key)}>{l.label}<span className="count">{portfolios.filter((p) => l.match(p.status)).length}</span></button>)}
      </div>
      {error && !portfolios.length ? <section className="panel"><LoadError what="portfolios" onRetry={reload} /></section> : loading && !portfolios.length ? <div className="grid g3">{[0, 1, 2].map((i) => <div key={i} className="panel skeleton" style={{ height: 210 }} />)}</div> : shown.length === 0 ? <Empty title={`No ${LISTS.find((l) => l.key === list)!.label.toLowerCase()}`} action={<button className="btn btn-quiet" onClick={() => setParams({ new: '1' })}>Create a portfolio</button>} /> : (
        <div className="grid g3">
          {shown.map((pf) => {
            const used = pf.lines.reduce((a: number, l: any) => a + l.amount, 0)
            const al = allocOf(pf.lines, P)
            return (
              <Link key={pf.id} to={`/studio/${pf.id}`} className="panel pf-card">
                <div className="spread"><span className="tiny muted num">{pf.id}</span><Status s={pf.status} /></div>
                <h3 style={{ margin: '8px 0 2px', fontSize: 17 }}>{pf.name}</h3>
                <div className="small muted">{whoName(pf.tag) || 'Not tagged: practice'}</div>
                <div className="display strong" style={{ fontSize: 22, margin: '14px 0 8px' }}>{inr(pf.amount)}</div>
                <AllocBar parts={Object.entries(al).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
                <div className="spread tiny muted" style={{ marginTop: 10 }}><span>{pf.lines.length} products · {Math.round((used / Math.max(1, pf.amount)) * 100)}% allocated</span><span>Updated {ago(pf.updated)}</span></div>
                {pf.note && <div className="tiny" style={{ marginTop: 8, color: pf.status === 'changes_requested' ? 'var(--loss)' : 'var(--muted)' }}>{pf.note}</div>}
              </Link>
            )
          })}
        </div>
      )}
      {creating && <CreateFlow onClose={() => setParams({})} />}
    </main>
  )
}

function CreateFlow({ onClose }: { onClose: () => void }) {
  const [params] = useSearchParams()
  const { data: models = [] } = useModels()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: prospects = [] } = useProspects()
  const preTag = params.get('tag')
  const [path, setPath] = useState<'choose' | 'agent' | 'recommended' | 'scratch' | 'import'>(params.get('model') ? 'recommended' : preTag ? 'choose' : 'choose')
  const [model, setModel] = useState<any>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(10000000)
  const [tag, setTag] = useState(preTag || '')
  const [json, setJson] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const toast = useToast()
  useEffect(() => { if (params.get('model') && models.length) setModel(models.find((m) => m.id === params.get('model'))) }, [models])
  const tagObj = tag ? { kind: tag.split(':')[0], id: tag.split(':')[1] } : null
  const taggedName = tagObj ? [...clients, ...prospects].find((x) => x.id === tagObj.id)?.name : ''
  useEffect(() => {
    if (!name && taggedName) setName(`${taggedName.split(' ').slice(-1)[0]} ${model ? model.name.toLowerCase() : 'portfolio'}`)
  }, [taggedName, model])
  useEffect(() => {
    const c = tagObj && [...clients, ...prospects].find((x) => x.id === tagObj.id)
    if (c) setAmount(Math.round((c.aum || c.estimated_investable || amount) / 100000) * 100000)
  }, [tag, clients.length])

  const create = async (body: any) => {
    const pf = await api('/portfolios', { body })
    invalidate('/c/portfolios')
    toast(`${pf.id} created`)
    onClose()
    nav(`/studio/${pf.id}`)
  }
  const fromModel = () => create({ name: name || model.name, amount, tag: tagObj, source: 'recommended', model_id: model.id, lines: model.allocations.map((a: any) => ({ product_id: a.product_id, amount: Math.round((amount * a.weight) / 100 / 1000) * 1000 })) })
  const fromScratch = () => create({ name: name || 'Untitled portfolio', amount, tag: tagObj, source: 'scratch', lines: [] })
  const fromJson = () => {
    try {
      const d = JSON.parse(json)
      const ids = new Set(products.map((p) => p.id))
      if (!Array.isArray(d.lines)) throw new Error('The file needs a "lines" list.')
      const amt = Number(d.amount) || d.lines.reduce((a: number, l: any) => a + (Number(l.amount) || 0), 0)
      const lines = d.lines.map((l: any) => ({ product_id: l.product_id, amount: l.amount ?? Math.round((amt * (l.weight || 0)) / 100) }))
      const bad = lines.filter((l: any) => !ids.has(l.product_id)).map((l: any) => l.product_id)
      if (bad.length) throw new Error(`Not on the Kova shelf: ${bad.join(', ')}`)
      create({ name: d.name ? `${d.name} (imported)` : 'Imported portfolio', amount: amt, tag: d.tag || tagObj, source: 'import', lines, note: d.note || '' })
    } catch (e: any) { setErr(e.message || 'That isn’t valid JSON.') }
  }
  const tagPicker = (
    <label className="field"><span>For</span>
      <select className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
        <option value="">No one yet (practice)</option>
        <optgroup label="Clients">{clients.filter((c) => c.segment !== 'lost').map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}</optgroup>
        <optgroup label="Prospects">{prospects.filter((p) => p.stage !== 'Closed').map((p) => <option key={p.id} value={`prospect:${p.id}`}>{p.name}</option>)}</optgroup>
      </select>
    </label>
  )
  const basics = (
    <div className="grid g3" style={{ gap: 12, marginBottom: 14 }}>
      <label className="field"><span>Portfolio name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Desai retirement income" /></label>
      <label className="field"><span>Starting amount (₹)</span><input className="input" type="number" step={100000} value={amount} onChange={(e) => setAmount(+e.target.value)} /><span className="tiny muted">{inr(amount)}</span></label>
      {tagPicker}
    </div>
  )
  return (
    <Modal wide title="Create a portfolio" sub="Every portfolio gets its own ID and is saved as JSON you can export." onClose={onClose}
      foot={path === 'recommended' ? <button className="btn btn-primary" disabled={!model} onClick={fromModel}>Open in canvas</button>
        : path === 'scratch' ? <button className="btn btn-primary" onClick={fromScratch}>Open empty canvas</button>
        : path === 'import' ? <button className="btn btn-primary" disabled={!json.trim()} onClick={fromJson}>Import</button> : undefined}>
      {path !== 'choose' && <button className="linkbtn small" style={{ marginBottom: 12 }} onClick={() => setPath('choose')}>← Other ways to start</button>}
      {path === 'choose' && (
        <div className="grid g2">
          <button className="choice" onClick={() => setPath('agent')}><Bot /><h3>With the agent</h3><p className="small muted">Answer a few questions and the agent drafts it on the canvas.</p><span className="pill brass" style={{ alignSelf: 'flex-start' }}>Preview</span></button>
          <button className="choice" onClick={() => setPath('recommended')}><Sparkles /><h3>From a recommended portfolio</h3><p className="small muted">Start from one of the CIO’s six model portfolios and adjust.</p></button>
          <button className="choice" onClick={() => setPath('scratch')}><SquarePen /><h3>From scratch</h3><p className="small muted">Set an amount and pick each product yourself.</p></button>
          <button className="choice" onClick={() => setPath('import')}><FileJson /><h3>Import JSON</h3><p className="small muted">Bring in a portfolio exported from Kova.</p></button>
        </div>
      )}
      {path === 'agent' && (
        <div className="agent-intake">
          <div className="msg agent"><span className="orb sm" /><div className="agent-text"><p>Who is this portfolio for, and how much are we working with?</p></div></div>
          <div className="msg rm"><div className="bubble">Vivek Malhotra, about ₹2.5 Cr from his stake sale in February.</div></div>
          <div className="msg agent"><span className="orb sm" /><div className="agent-text"><p>What’s the money for, and when might he need it? Anything he’s ruled out?</p></div></div>
          <p className="small muted" style={{ marginTop: 16 }}>Coming soon. In the full release the agent asks these questions, then builds the draft on the canvas for you to edit.</p>
        </div>
      )}
      {path === 'recommended' && (
        <>
          {basics}
          <div className="col" style={{ gap: 8 }}>
            {models.map((m) => (
              <button key={m.id} className={`model-row ${model?.id === m.id ? 'on' : ''}`} onClick={() => setModel(m)}>
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div className="spread"><span className="strong">{m.name}</span><span className="small muted">{m.risk} · {m.horizon} · {m.expected_return} a year</span></div>
                  <div className="small muted" style={{ margin: '2px 0 8px' }}>{m.description}</div>
                  <AllocBar parts={Object.entries(allocOf(m.allocations.map((a: any) => ({ product_id: a.product_id, amount: a.weight })), Object.fromEntries(products.map((p) => [p.id, p])))).map(([k, v]) => ({ label: k, value: v, color: ASSET_COLORS[k] }))} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {path === 'scratch' && basics}
      {path === 'import' && (
        <>
          <label className="btn btn-quiet" style={{ marginBottom: 10 }}><Upload />Choose a .json file<input type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setJson(await f.text()) }} /></label>
          <textarea className="textarea mono" rows={10} value={json} onChange={(e) => { setJson(e.target.value); setErr('') }} placeholder={'{\n  "name": "Bond ladder",\n  "amount": 10000000,\n  "lines": [{ "product_id": "PD-403", "amount": 2500000 }]\n}'} />
          {err && <p className="small" style={{ color: 'var(--loss)', marginTop: 8 }}>{err}</p>}
        </>
      )}
    </Modal>
  )
}
