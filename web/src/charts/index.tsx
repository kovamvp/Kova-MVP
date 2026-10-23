import { ReactNode, useState } from 'react'

/* Small hand-drawn SVG charts so they match the brand exactly. */

export type Slice = { label: string; value: number; color: string; note?: string }

export function Donut({ data, size = 150, thick = 18, center }: { data: Slice[]; size?: number; thick?: number; center?: ReactNode }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const r = (size - thick) / 2
  const c = 2 * Math.PI * r
  const [hover, setHover] = useState<number | null>(null)
  let off = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--stone)" strokeWidth={thick} />
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const gap = data.length > 1 ? Math.min(3, len / 3) : 0
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={hover === i ? thick + 4 : thick}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ transition: 'stroke-width .12s' }} />
          )
          off += len
          return el
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        {hover !== null ? (
          <div><div className="display" style={{ fontSize: 20, color: 'var(--ink-strong)' }}>{data[hover].note ?? data[hover].value}</div><div className="tiny muted">{data[hover].label}</div></div>
        ) : center}
      </div>
    </div>
  )
}

export function Legend({ data, format = (v: number) => String(v) }: { data: Slice[]; format?: (v: number) => string }) {
  return (
    <div className="col" style={{ gap: 7 }}>
      {data.map((d) => (
        <div key={d.label} className="spread small">
          <span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />{d.label}</span>
          <span className="num strong">{format(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function HBars({ data, format = (v: number) => String(v), max }: { data: { label: ReactNode; value: number; color?: string; sub?: ReactNode }[]; format?: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="col" style={{ gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div className="spread small" style={{ marginBottom: 4 }}>
            <span className="ellipsis">{d.label}</span>
            <span className="num strong">{format(d.value)}</span>
          </div>
          <div className="bar"><i style={{ width: `${(d.value / m) * 100}%`, background: d.color }} /></div>
          {d.sub && <div className="tiny muted" style={{ marginTop: 3 }}>{d.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function Columns({ data, height = 140, format = (v: number) => String(v), color = 'var(--forest)', highlightLast = true }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string; color?: string; highlightLast?: boolean }) {
  const m = Math.max(1, ...data.map((d) => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: height + 34 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }} title={`${d.label}: ${format(d.value)}`}>
          <span className="tiny num muted">{format(d.value)}</span>
          <div style={{ width: '100%', maxWidth: 36, height: Math.max(3, (d.value / m) * height), background: highlightLast && i === data.length - 1 ? 'var(--brass)' : color, borderRadius: '4px 4px 2px 2px', opacity: highlightLast && i !== data.length - 1 ? 0.85 : 1 }} />
          <span className="tiny muted ellipsis" style={{ maxWidth: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Area({ points, height = 90, width = 320, format = (v: number) => String(v), labels }: { points: number[]; height?: number; width?: number; format?: (v: number) => string; labels?: string[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return null
  const min = Math.min(...points) * 0.97
  const max = Math.max(...points) * 1.01
  const x = (i: number) => (i / (points.length - 1)) * width
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * (height - 8) - 4
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1))) }}>
        <defs>
          <linearGradient id="kova-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D3A2E" stopOpacity=".16" /><stop offset="1" stopColor="#1D3A2E" stopOpacity="0" /></linearGradient>
        </defs>
        <path d={area} fill="url(#kova-area)" />
        <path d={line} fill="none" stroke="var(--forest)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="3.5" fill="var(--paper)" stroke="var(--brass)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ opacity: 1, left: `${(hover / (points.length - 1)) * 100}%`, bottom: '100%', transform: 'translate(-50%, -4px)' }}>
          {labels?.[hover] ? `${labels[hover]}: ` : ''}{format(points[hover])}
        </div>
      )}
    </div>
  )
}

export function AllocBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const t = parts.reduce((a, p) => a + p.value, 0) || 1
  return (
    <div className="alloc" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / t) * 100)}%`).join(', ')}>
      {parts.filter((p) => p.value > 0).map((p) => <i key={p.label} title={`${p.label} ${Math.round((p.value / t) * 100)}%`} style={{ width: `${(p.value / t) * 100}%`, background: p.color }} />)}
    </div>
  )
}
