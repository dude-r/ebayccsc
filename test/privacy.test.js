import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CCSC_DATA as D } from '../src/data/ccsc-data.js'

// This is a PUBLIC repo and the dataset ships to a public site. These tests
// fail loudly if a data regeneration ever reintroduces buyer PII or raw order
// identifiers. Run scripts/build-data.mjs to (re)produce a compliant dataset.

const dataFile = fileURLToPath(new URL('../src/data/ccsc-data.js', import.meta.url))
const rawText = readFileSync(dataFile, 'utf8')

describe('no buyer PII in the shipped dataset', () => {
  it('contains no city or state fields anywhere', () => {
    expect(rawText).not.toMatch(/"city"\s*:/)
    expect(rawText).not.toMatch(/"state"\s*:/)
  })

  it('has no top-level orders[] buyer table', () => {
    expect(D.orders).toBeUndefined()
  })

  it('exposes no unmasked eBay order ids (only last 4 digits kept)', () => {
    for (const c of D.cards) {
      if (c.order == null) continue
      // A compliant masked id reveals at most 4 digits total.
      const digits = String(c.order).replace(/\D/g, '')
      expect(digits.length, `order "${c.order}" exposes too many digits`).toBeLessThanOrEqual(4)
      expect(c.order).toMatch(/•/)
    }
  })
})
