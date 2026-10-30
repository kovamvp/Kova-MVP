import { describe, expect, it } from 'vitest'
import { comparePoint, drill, pointLabel, revenueSoFar } from '../drill'

const products = [
  { id: 'P1', name: 'Flexi', asset_class: 'Equity', product_type: 'Mutual fund', subcategory: 'Flexi cap' },
  { id: 'P2', name: 'Mid', asset_class: 'Equity', product_type: 'Mutual fund', subcategory: 'Mid cap' },
  { id: 'P3', name: 'PMS One', asset_class: 'Equity', product_type: 'PMS', subcategory: 'Multi cap quality' },
  { id: 'P4', name: 'Bond', asset_class: 'Debt', product_type: 'Bond', subcategory: 'G-Sec' },
]
const hist = (by: Record<string, number>[], rev: number[] = []) =>
  ['2025-03', '2025-07', '2025-09', '2025-10'].map((month, i) => ({ month, value: Object.values(by[i]).reduce((a, b) => a + b, 0), invested: 0, revenue: rev[i] ?? 0, by_class: {}, by_product: by[i] }))
const clients = [
  { id: 'C1', name: 'Asha', holdings: [{ product_id: 'P1', value: 100 }, { product_id: 'P4', value: 50 }],
    history: hist([{ P1: 60, P4: 50 }, { P1: 80, P4: 50 }, { P1: 90, P4: 50 }, { P1: 100, P4: 50 }]) },
  { id: 'C2', name: 'Bala', holdings: [{ product_id: 'P2', value: 40 }, { product_id: 'P3', value: 60 }],
    history: hist([{ P2: 40 }, { P2: 40 }, { P2: 40, P3: 50 }, { P2: 40, P3: 60 }]) },
]
const LEVELS = ['asset_class', 'product_type', 'subcategory', 'product', 'client'] as const

describe('comparison points', () => {
  const months = ['2025-03', '2025-07', '2025-09', '2025-10']
  it('picks last month, three months back and the end of the last fiscal year', () => {
    expect(comparePoint(months, 'month')).toBe('2025-09')
    expect(comparePoint(months, 'quarter')).toBe('2025-07')
    expect(comparePoint(months, 'fy')).toBe('2025-03')
  })
  it('says nothing when the history is too short', () => {
    expect(comparePoint(['2025-10'], 'month')).toBeUndefined()
    expect(comparePoint(['2025-09', '2025-10'], 'fy')).toBeUndefined()
  })
  it('labels the point in plain words', () => {
    expect(pointLabel('2025-03', 'fy')).toBe('since 31 Mar 2025')
    expect(pointLabel('2025-09', 'month')).toBe('since end of Sep')
  })
})

describe('drill', () => {
  it('groups the book by asset class with share, clients and change', () => {
    const d = drill(clients, products, [], [...LEVELS], 'fy')
    expect(d.level).toBe('asset_class')
    expect(d.total).toBe(250)
    expect(d.prevTotal).toBe(150)
    const eq = d.rows.find((r) => r.key === 'Equity')!
    expect(eq.value).toBe(200)
    expect(eq.share).toBeCloseTo(0.8)
    expect(eq.clients).toBe(2)
    expect(eq.prev).toBe(100)
    expect(eq.next).toBe('product_type')
    expect(d.rows[0].key).toBe('Equity') // largest first
  })
  it('goes deeper one level at a time and shows a newly bought line as new', () => {
    const path = [{ level: 'asset_class' as const, key: 'Equity', label: 'Equity' }, { level: 'product_type' as const, key: 'PMS', label: 'PMS' }]
    const d = drill(clients, products, path, [...LEVELS], 'fy')
    expect(d.level).toBe('subcategory')
    expect(d.rows).toHaveLength(1)
    expect(d.rows[0]).toMatchObject({ key: 'Multi cap quality', value: 60, prev: 0 })
    expect(d.rows[0].pct).toBeUndefined()
  })
  it('ends at the clients who hold a product, which can’t go further', () => {
    const path = [{ level: 'asset_class' as const, key: 'Equity', label: 'Equity' }, { level: 'product_type' as const, key: 'Mutual fund', label: 'Mutual fund' },
      { level: 'subcategory' as const, key: 'Flexi cap', label: 'Flexi cap' }, { level: 'product' as const, key: 'P1', label: 'Flexi' }]
    const d = drill(clients, products, path, [...LEVELS], 'month')
    expect(d.level).toBe('client')
    expect(d.rows).toEqual([expect.objectContaining({ key: 'C1', label: 'Asha', value: 100, prev: 90, next: undefined })])
    expect(d.rows[0].pct).toBeCloseTo(11.11, 1)
  })
  it('can start from product type instead of asset class', () => {
    const d = drill(clients, products, [], ['product_type', 'subcategory', 'product', 'client'], 'quarter')
    expect(d.rows.map((r) => r.key)).toEqual(['Mutual fund', 'PMS', 'Bond'])
    expect(d.rows.find((r) => r.key === 'Mutual fund')!.prev).toBe(120)
  })
})

describe('revenue so far this fiscal year vs the same months last year', () => {
  it('adds up April to now, and the same months a year earlier', () => {
    const months = ['2024-04', '2024-05', '2025-03', '2025-04', '2025-05'].map((month, i) => ({ month, revenue: [10, 20, 99, 15, 25][i] }))
    expect(revenueSoFar(months)).toEqual({ now: 40, before: 30, from: '2025-04' })
  })
})
