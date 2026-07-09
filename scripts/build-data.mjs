// Builds src/data/ccsc-data.js from the canonical computed dataset in
// design/project/ccsc-data.js, applying a privacy scrub so no customer PII or
// raw order identifiers ship in this public repo / on the live site.
//
// Run:  node scripts/build-data.mjs
//
// Scrub rules (applied recursively across the whole dataset):
//   - drop every `city` / `state` field (buyer locations, never displayed) —
//     these appear on cards AND inside lossBuckets
//   - mask every `order` id to its last 4 digits (the modal still shows a
//     recognizable-but-not-identifying order reference)
//   - drop the top-level `orders[]` array entirely (unused by the app and a
//     full buyer-location table)
//
// Everything else (financials, titles, sport, dates, channel) is preserved
// verbatim, so every displayed figure still reconciles to the ledger.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// The unscrubbed source contains buyer PII, so it is NOT committed. Keep your
// raw eBay-derived dataset (the `window.CCSC_DATA = {…}` file) here locally:
const SRC = resolve(__dirname, '../raw/ccsc-data-source.js')
// The scrubbed dataset is the business's financials — also kept OUT of the repo
// (untracked). Only the ENCRYPTED form (public/ccsc-data.enc.json, produced by
// scripts/encrypt-data.mjs) is committed and deployed.
const OUT = resolve(__dirname, '../raw/ccsc-data.scrubbed.json')

if (!existsSync(SRC)) {
  console.error(
    `Missing raw source: ${SRC}\n\n` +
      `The unscrubbed dataset carries buyer PII and is intentionally kept out of\n` +
      `this repo (see raw/ in .gitignore). Drop your raw CCSC_DATA file there as\n` +
      `raw/ccsc-data-source.js, then re-run: npm run build:data`
  )
  process.exit(1)
}

// The source file is `window.CCSC_DATA = {…};` — extract the JSON literal.
const raw = readFileSync(SRC, 'utf8')
const json = raw.slice(raw.indexOf('=') + 1).trim().replace(/;\s*$/, '')
const D = JSON.parse(json)

// Mask an eBay order id, preserving format but revealing only the last 4
// digits (all earlier digits → •), regardless of dashes.
function maskOrder(order) {
  const digits = String(order).replace(/\D/g, '')
  const keepFrom = Math.max(0, digits.length - 4)
  let seen = 0
  return String(order).replace(/\d/g, (d) => (seen++ >= keepFrom ? d : '•'))
}

// The orders[] array is never read by the app and is a full buyer-location
// table — drop it before scrubbing the rest.
const hadOrders = Array.isArray(D.orders)
delete D.orders

// Recursively strip city/state and mask order ids everywhere they appear.
const stats = { city: 0, state: 0, order: 0 }
function scrub(node) {
  if (Array.isArray(node)) {
    node.forEach(scrub)
  } else if (node && typeof node === 'object') {
    if ('city' in node) {
      delete node.city
      stats.city++
    }
    if ('state' in node) {
      delete node.state
      stats.state++
    }
    if (typeof node.order === 'string') {
      node.order = maskOrder(node.order)
      stats.order++
    }
    for (const v of Object.values(node)) scrub(v)
  }
}
scrub(D)
const scrubbedCards = D.cards.length

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(D, null, 2) + '\n')

console.log(
  `Wrote ${OUT}\n  cards: ${scrubbedCards}\n  city fields removed: ${stats.city}\n  state fields removed: ${stats.state}\n  order ids masked: ${stats.order}\n  orders[] table removed: ${hadOrders}\n  sample masked order: ${D.cards?.[0]?.order}\n\nNext: npm run encrypt   (produces public/ccsc-data.enc.json)`
)
