import { describe, expect, it } from 'vitest'
import { cap, inr, initials, label, pct } from '../format'

describe('inr', () => {
  it('uses crore and lakh', () => {
    expect(inr(142_20_00_000)).toBe('₹142 Cr')
    expect(inr(1_84_00_000)).toBe('₹1.84 Cr')
    expect(inr(2_00_00_000)).toBe('₹2 Cr')
    expect(inr(95_00_000)).toBe('₹95 L')
    expect(inr(4_50_000)).toBe('₹4.5 L')
  })
  it('groups small numbers the Indian way', () => {
    expect(inr(34_780)).toBe('₹34,780')
    expect(inr(12_34_567, { compact: false })).toBe('₹12,34,567')
  })
  it('handles signs and missing values', () => {
    expect(inr(-10_000)).toBe('−₹10,000')
    expect(inr(5_00_000, { sign: true })).toBe('+₹5 L')
    expect(inr(null)).toBe('—')
    expect(inr(undefined)).toBe('—')
  })
})

describe('text helpers', () => {
  it('initials skip honorifics', () => {
    expect(initials('Dr. Imran Qureshi')).toBe('IQ')
    expect(initials('Sahil & Priyanka Arora')).toBe('SP')
  })
  it('labels', () => {
    expect(label('awaiting_approval')).toBe('Awaiting approval')
    expect(cap('active')).toBe('Active')
    expect(pct(12.345)).toBe('12.3%')
  })
})
