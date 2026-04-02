import { describe, it, expect } from 'vitest'
import { safeStr, clampLevel, localDateStr, parseBQDate } from '../route-utils'

describe('safeStr', () => {
  it('strips dangerous characters', () => {
    expect(safeStr('hello`world')).toBe('helloworld')
    expect(safeStr("it's a test")).toBe('its a test')
    expect(safeStr('drop;table')).toBe('droptable')
    expect(safeStr('say "hi"')).toBe('say hi')
    expect(safeStr('back\\slash')).toBe('backslash')
  })

  it('truncates to maxLen', () => {
    expect(safeStr('abcdefghij', 5)).toBe('abcde')
    expect(safeStr('short', 100)).toBe('short')
  })

  it('handles empty/null/undefined', () => {
    expect(safeStr('')).toBe('')
    expect(safeStr(null)).toBe('')
    expect(safeStr(undefined)).toBe('')
  })

  it('coerces non-strings', () => {
    expect(safeStr(42)).toBe('42')
    expect(safeStr(true)).toBe('true')
  })
})

describe('clampLevel', () => {
  it('clamps to 1-10 range', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(-5)).toBe(1)
    expect(clampLevel(15)).toBe(10)
    expect(clampLevel(100)).toBe(10)
  })

  it('rounds to nearest integer', () => {
    expect(clampLevel(5.7)).toBe(6)
    expect(clampLevel(3.2)).toBe(3)
  })

  it('passes through valid values', () => {
    expect(clampLevel(1)).toBe(1)
    expect(clampLevel(5)).toBe(5)
    expect(clampLevel(10)).toBe(10)
  })

  it('returns null for null/undefined/NaN', () => {
    expect(clampLevel(null)).toBeNull()
    expect(clampLevel(undefined)).toBeNull()
    expect(clampLevel('abc')).toBeNull()
    expect(clampLevel(NaN)).toBeNull()
  })
})

describe('localDateStr', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date(2024, 0, 15) // Jan 15, 2024
    expect(localDateStr(d)).toBe('2024-01-15')
  })

  it('pads single-digit month and day', () => {
    const d = new Date(2024, 2, 5) // Mar 5, 2024
    expect(localDateStr(d)).toBe('2024-03-05')
  })
})

describe('parseBQDate', () => {
  it('extracts .value from BigQuery date objects', () => {
    expect(parseBQDate({ value: '2024-01-15' })).toBe('2024-01-15')
  })

  it('passes through plain strings', () => {
    expect(parseBQDate('2024-01-15')).toBe('2024-01-15')
  })
})
