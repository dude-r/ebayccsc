import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Guards the core promise of this report: every displayed figure traces to the
// ledger and reconciles. Runs against the scrubbed dataset, which is kept
// untracked (raw/) because it is the business's financials. In a fresh public
// checkout the file is absent, so these are skipped there and run locally /
// wherever the data is present.
const dataPath = fileURLToPath(new URL('../raw/ccsc-data.scrubbed.json', import.meta.url))
// Expected headline figures for the CURRENT dataset. scripts/add-month.mjs
// rewrites this file on every monthly update, so tests stay pinned without
// hand edits.
const PINS = JSON.parse(readFileSync(fileURLToPath(new URL('./pins.json', import.meta.url)), 'utf8'))
const present = existsSync(dataPath)
const D = present ? JSON.parse(readFileSync(dataPath, 'utf8')) : null

const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps
const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0)

describe.skipIf(!present)('CCSC dataset reconciliation', () => {
  describe('H1 headline', () => {
    it('nets to the pinned figure after supplies', () => {
      expect(near(D.H1.net_after_supplies, PINS.net_after_supplies)).toBe(true)
    })

    it('net proceeds − supplies = net after supplies (waterfall closes)', () => {
      expect(near(D.H1.net_proceeds - D.H1.supplies, D.H1.net_after_supplies)).toBe(true)
    })

    it('has the pinned card and order counts', () => {
      expect(D.H1.cards_net).toBe(PINS.cards)
      expect(D.H1.orders).toBe(PINS.orders)
    })
  })

  describe('monthly rolls up to H1', () => {
    const fields = ['item_sales', 'full_ledger_fees', 'supplies', 'net_after_supplies', 'cards_net', 'orders', 'ship_pl']
    for (const f of fields) {
      it(`sum(monthly.${f}) === H1.${f}`, () => {
        expect(near(sumBy(D.monthly, (m) => m[f]), D.H1[f])).toBe(true)
      })
    }

    it('covers exactly the pinned months', () => {
      expect(D.monthly.map((m) => m.month)).toEqual(PINS.months)
    })
  })

  describe('quarters roll up to H1', () => {
    // Computed inside each test — the describe body is still evaluated at
    // collection time even when skipped, so it must not dereference D.
    const pick = (months) => D.monthly.filter((m) => months.includes(m.month))

    it('Q1 + Q2 + Q3 item sales === YTD item sales', () => {
      const q1 = pick(['Jan', 'Feb', 'Mar'])
      const q2 = pick(['Apr', 'May', 'Jun'])
      const q3 = pick(['Jul', 'Aug', 'Sep'])
      expect(near(sumBy(q1, (m) => m.item_sales) + sumBy(q2, (m) => m.item_sales) + sumBy(q3, (m) => m.item_sales), D.H1.item_sales)).toBe(true)
    })

    it('Q1 + Q2 + Q3 net kept === YTD net kept', () => {
      const q1 = pick(['Jan', 'Feb', 'Mar'])
      const q2 = pick(['Apr', 'May', 'Jun'])
      const q3 = pick(['Jul', 'Aug', 'Sep'])
      expect(
        near(
          sumBy(q1, (m) => m.net_after_supplies) + sumBy(q2, (m) => m.net_after_supplies) + sumBy(q3, (m) => m.net_after_supplies),
          D.H1.net_after_supplies
        )
      ).toBe(true)
    })
  })

  describe('prior-year baseline', () => {
    it('carries the 2025 baseline with all 12 months', () => {
      expect(D.prior_year?.year).toBe(2025)
      expect(Object.keys(D.prior_year.monthly)).toHaveLength(12)
      expect(near(D.prior_year.revenue, D.prior_year.item_sales + D.prior_year.ship_charged)).toBe(true)
    })
  })

  describe('traffic snapshot', () => {
    it('carries a traffic window with impressions', () => {
      expect(typeof D.traffic?.window).toBe('string')
      expect(D.traffic.impressions).toBeGreaterThan(0)
    })
  })

  describe('card grid integrity', () => {
    it('has exactly the pinned number of card records', () => {
      expect(D.cards).toHaveLength(PINS.cards)
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
