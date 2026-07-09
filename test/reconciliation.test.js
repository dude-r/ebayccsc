import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Guards the core promise of this report: every displayed figure traces to the
// ledger and reconciles. Runs against the scrubbed dataset, which is kept
// untracked (raw/) because it is the business's financials. In a fresh public
// checkout the file is absent, so these are skipped there and run locally /
// wherever the data is present.
const dataPath = fileURLToPath(new URL('../raw/ccsc-data.scrubbed.json', import.meta.url))
const present = existsSync(dataPath)
const D = present ? JSON.parse(readFileSync(dataPath, 'utf8')) : null

const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps
const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0)

describe.skipIf(!present)('CCSC dataset reconciliation', () => {
  describe('H1 headline', () => {
    it('nets to $1,614.09 after supplies', () => {
      expect(near(D.H1.net_after_supplies, 1614.09)).toBe(true)
    })

    it('net proceeds − supplies = net after supplies (waterfall closes)', () => {
      expect(near(D.H1.net_proceeds - D.H1.supplies, D.H1.net_after_supplies)).toBe(true)
    })

    it('has 112 cards sold across 116 orders', () => {
      expect(D.H1.cards_net).toBe(112)
      expect(D.H1.orders).toBe(116)
    })
  })

  describe('monthly rolls up to H1', () => {
    const fields = ['item_sales', 'full_ledger_fees', 'supplies', 'net_after_supplies', 'cards_net', 'orders', 'ship_pl']
    for (const f of fields) {
      it(`sum(monthly.${f}) === H1.${f}`, () => {
        expect(near(sumBy(D.monthly, (m) => m[f]), D.H1[f])).toBe(true)
      })
    }

    it('covers exactly the six H1 months', () => {
      expect(D.monthly.map((m) => m.month)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'])
    })
  })

  describe('quarters roll up to H1', () => {
    const pick = (months) => D.monthly.filter((m) => months.includes(m.month))
    const q1 = pick(['Jan', 'Feb', 'Mar'])
    const q2 = pick(['Apr', 'May', 'Jun'])

    it('Q1 + Q2 item sales === H1 item sales', () => {
      expect(near(sumBy(q1, (m) => m.item_sales) + sumBy(q2, (m) => m.item_sales), D.H1.item_sales)).toBe(true)
    })

    it('Q1 + Q2 net kept === H1 net kept', () => {
      expect(
        near(sumBy(q1, (m) => m.net_after_supplies) + sumBy(q2, (m) => m.net_after_supplies), D.H1.net_after_supplies)
      ).toBe(true)
    })
  })

  describe('card grid integrity', () => {
    it('has exactly 112 card records', () => {
      expect(D.cards).toHaveLength(112)
    })

    it('every card has the fields the report renders', () => {
      for (const c of D.cards) {
        for (const key of ['title', 'sport', 'month', 'item_sales', 'fees', 'supplies', 'nas', 'band', 'item_id']) {
          expect(c, `card ${c.item_id} missing ${key}`).toHaveProperty(key)
        }
      }
    })

    it('card net (nas) = sale + ship − fees − supplies within a cent', () => {
      for (const c of D.cards) {
        expect(near(c.item_sales + c.ship - c.fees - c.supplies, c.nas, 0.02), `card ${c.item_id} nas off`).toBe(true)
      }
    })
  })
})
