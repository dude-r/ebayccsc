import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// This is a PUBLIC repo and the app deploys to a public URL. These tests fail
// loudly if buyer PII, raw order ids, or plaintext financials ever ship.
const url = (p) => fileURLToPath(new URL(p, import.meta.url))

const scrubbedPath = url('../raw/ccsc-data.scrubbed.json')
const encPath = url('../public/ccsc-data.enc.json')

describe.skipIf(!existsSync(scrubbedPath))('scrubbed dataset carries no buyer PII', () => {
  const text = existsSync(scrubbedPath) ? readFileSync(scrubbedPath, 'utf8') : ''
  const D = text ? JSON.parse(text) : {}

  it('contains no city or state fields', () => {
    expect(text).not.toMatch(/"city"\s*:/)
    expect(text).not.toMatch(/"state"\s*:/)
  })

  it('has no top-level orders[] buyer table', () => {
    expect(D.orders).toBeUndefined()
  })

  it('exposes no unmasked eBay order ids (last 4 digits only)', () => {
    for (const c of D.cards ?? []) {
      if (c.order == null) continue
      const digits = String(c.order).replace(/\D/g, '')
      expect(digits.length, `order "${c.order}" exposes too many digits`).toBeLessThanOrEqual(4)
      expect(c.order).toMatch(/•/)
    }
  })
})

describe.skipIf(!existsSync(encPath))('the SHIPPED data blob is opaque ciphertext', () => {
  const text = readFileSync(encPath, 'utf8')
  const blob = JSON.parse(text)

  it('is an AES-GCM / PBKDF2 envelope with salt+iv+ciphertext', () => {
    expect(blob.alg).toBe('AES-GCM')
    expect(blob.kdf).toMatch(/PBKDF2/)
    expect(blob.iterations).toBeGreaterThanOrEqual(100000)
    for (const k of ['salt', 'iv', 'ct']) expect(typeof blob[k]).toBe('string')
  })

  it('leaks no plaintext financials or PII', () => {
    // Nothing recognizable from the dataset should appear in the ciphertext.
    for (const needle of ['"city"', '"state"', 'Risacher', 'net_after_supplies', 'item_sales', 'Cream City']) {
      expect(text).not.toContain(needle)
    }
  })
})
