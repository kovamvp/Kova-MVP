import { describe, expect, it } from 'vitest'
import { assetClassOf, fitsProfile, ldStats } from '../data'

const fund = (risk: string, category = 'Mutual fund', sub = 'Equity: Flexi cap', id = 'PD-X') => ({ id, risk, category, sub_category: sub })

describe('fitsProfile (suitability rule shared with the agent)', () => {
  it('lets diversified products sit up to two levels above the profile', () => {
    expect(fitsProfile(fund('Very high'), 'Moderate')).toBe(true)
    expect(fitsProfile(fund('Very high'), 'Moderately conservative')).toBe(false)
    expect(fitsProfile(fund('Moderate'), 'Conservative')).toBe(true)
    expect(fitsProfile(fund('High'), 'Conservative')).toBe(false)
  })
  it('keeps PMS and AIF for moderately aggressive and above', () => {
    expect(fitsProfile(fund('Very high', 'PMS'), 'Moderate')).toBe(false)
    expect(fitsProfile(fund('Very high', 'PMS'), 'Moderately aggressive')).toBe(true)
    expect(fitsProfile(fund('High', 'AIF'), 'Aggressive')).toBe(true)
  })
  it('passes when the profile is unknown', () => {
    expect(fitsProfile(fund('Very high'), 'Not assessed')).toBe(true)
  })
})

describe('assetClassOf', () => {
  it('classifies the shelf', () => {
    expect(assetClassOf(fund('High', 'Mutual fund', 'Commodity: Gold'))).toBe('Gold')
    expect(assetClassOf({ id: 'PD-110', category: 'Mutual fund', sub_category: 'Hybrid: Arbitrage' })).toBe('Cash')
    expect(assetClassOf({ id: 'PD-401', category: 'Bond', sub_category: 'Secured NCD' })).toBe('Debt')
    expect(assetClassOf({ id: 'PD-301', category: 'AIF', sub_category: 'Category II' })).toBe('Debt')
    expect(assetClassOf(fund('Very high'))).toBe('Equity')
  })
})

describe('ldStats', () => {
  it('counts done, started and not started', () => {
    const p = (id: string) => ({ id, name: id, ld: { modules: [{ id: 'm1' }, { id: 'm2' }] } })
    const s = ldStats([p('a'), p('b'), p('c')], [{ product_id: 'a', completed: ['m1', 'm2'] }, { product_id: 'b', completed: ['m1'] }])
    expect([s.done, s.started, s.notStarted]).toEqual([1, 1, 1])
    expect(s.overall).toBe(50)
  })
})
