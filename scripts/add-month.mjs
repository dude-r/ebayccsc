// Adds one month of eBay sales to the encrypted dataset — the monthly-close
// pipeline for this report.
//
//   SITE_PASSWORD=… node scripts/add-month.mjs \
//     --orders  path/to/eBay-orders.csv   (Seller Hub → Orders → download)
//     --txn     path/to/Transaction_report.csv (Payments → Reports → Transaction report, ONE month)
//     [--month Jul --year 2026]           (default: the month after meta.last_month)
//     [--sports path/to/sports.json]      ({item_id: sport} overrides for titles
//                                          the keyword heuristic can't classify)
//
// The ENCRYPTED blob (public/ccsc-data.enc.json) is the canonical dataset —
// this script decrypts it, extends it, and re-encrypts it. The old
// raw/ccsc-data-source.js → build-data.mjs path is superseded; do not use it,
// it will regress the site to H1.
//
// HARD RECONCILIATION GATE (non-negotiable): the Orders export alone lies by
// omission — no fees, no refunds, no labels. Every order in the month must
// appear in BOTH files with item price and shipping matching to the penny, or
// this script refuses to write anything.
import { pbkdf2Sync, createDecipheriv, randomBytes, createCipheriv } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rp = (p) => resolve(__dirname, '..', p)
const r2 = (v) => Math.round(v * 100) / 100
const die = (msg) => { console.error('\nABORT: ' + msg); process.exit(1) }

// ---------- args ----------
const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
if (!args.orders || !args.txn) die('usage: --orders <orders.csv> --txn <transaction_report.csv> [--month Jul] [--year 2026] [--sports overrides.json]')
const BLOB_IN = args['blob-in'] || rp('public/ccsc-data.enc.json')
const BLOB_OUT = args['blob-out'] || rp('public/ccsc-data.enc.json')
const SCRUB_OUT = args['scrubbed-out'] || rp('raw/ccsc-data.scrubbed.json')
const PINS_OUT = args['pins-out'] || rp('test/pins.json')
const PASSWORD = process.env.SITE_PASSWORD
if (!PASSWORD) die('SITE_PASSWORD env var is required (decrypts and re-encrypts the dataset)')
const sportsOverride = args.sports ? JSON.parse(readFileSync(args.sports, 'utf8')) : {}

// ---------- decrypt canonical dataset ----------
const b64 = (s) => Buffer.from(s, 'base64')
const blob = JSON.parse(readFileSync(BLOB_IN, 'utf8'))
let D
try {
  const key = pbkdf2Sync(PASSWORD, b64(blob.salt), blob.iterations, 32, 'sha256')
  const ct = b64(blob.ct)
  const d = createDecipheriv('aes-256-gcm', key, b64(blob.iv))
  d.setAuthTag(ct.subarray(ct.length - 16))
  D = JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8'))
} catch {
  die('could not decrypt ' + BLOB_IN + ' — wrong SITE_PASSWORD?')
}

const MONTH_SEQ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH = args.month || MONTH_SEQ[MONTH_SEQ.indexOf(D.meta.last_month) + 1]
const YEAR = Number(args.year || (D.meta.period.match(/(\d{4})/) || [])[1] || new Date().getFullYear())
if (!MONTH_SEQ.includes(MONTH)) die('bad --month ' + MONTH)
if (D.monthly.some((m) => m.month === MONTH)) die(MONTH + ' is already in the dataset — refusing to double-add')
console.log(`Adding ${MONTH} ${YEAR} to dataset currently through ${D.meta.last_month}…`)

// ---------- tiny CSV parser (quoted fields, commas) ----------
function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row) }
  return rows
}
const money = (v) => {
  v = String(v ?? '').replace(/[$,]/g, '').trim()
  if (!v || v === '--' || v === '-') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ---------- parse the Orders export ----------
const oRows = parseCsv(readFileSync(args.orders, 'utf8').replace(/^﻿/, ''))
const oHdr = oRows.find((r) => r.includes('Sale Date') && r.includes('Item Title'))
if (!oHdr) die('orders CSV: could not find the header row')
const oi = (name) => oHdr.indexOf(name)
const O = { rec: oi('Sales Record Number'), order: oi('Order Number'), item: oi('Item Number'), title: oi('Item Title'), qty: oi('Quantity'), sale: oi('Sold For'), ship: oi('Shipping And Handling'), date: oi('Sale Date'), promo: oi('Sold Via Promoted Listings') }
const g = (r, i) => (i >= 0 && i < r.length ? r[i] : '')
const parseSaleDate = (s) => {
  const m = String(s).trim().match(/^([A-Za-z]{3})-(\d{2})-(\d{2,4})$/)
  if (!m) return null
  return { mon: m[1], day: Number(m[2]), year: Number(m[3].length === 2 ? '20' + m[3] : m[3]) }
}
let oData = oRows.slice(oRows.indexOf(oHdr) + 1).filter((r) => /^\d+$/.test(g(r, O.rec).trim()) && parseSaleDate(g(r, O.date)))
// collapse eBay's multi-item orders: summary row (blank item number) + one
// detail row per item. Keep details; move the summary's shipping onto the first.
const byOrder = {}
for (const r of oData) (byOrder[g(r, O.order)] ||= []).push(r)
const keep = []
for (const [, group] of Object.entries(byOrder)) {
  if (group.length === 1) { keep.push(group[0]); continue }
  const details = group.filter((r) => g(r, O.item).trim())
  const summaries = group.filter((r) => !g(r, O.item).trim())
  if (!details.length || !summaries.length) { keep.push(...group); continue }
  if (money(g(details[0], O.ship)) === 0) details[0][O.ship] = g(summaries[0], O.ship)
  keep.push(...details)
}
const monthOrders = keep
  .map((r) => ({ ...Object.fromEntries(Object.entries(O).map(([k, i]) => [k, g(r, i).trim()])), d: parseSaleDate(g(r, O.date)) }))
  .filter((o) => o.d.mon === MONTH && o.d.year === YEAR)
  .map((o) => ({ order: o.order, item_id: o.item, title: o.title, day: o.d.day, sale: money(o.sale), ship: money(o.ship), promoted: /^yes$/i.test(o.promo) }))
  .sort((a, b) => a.day - b.day)
if (!monthOrders.length) die(`orders CSV has no ${MONTH} ${YEAR} rows`)
console.log(`  orders CSV: ${monthOrders.length} ${MONTH} sale(s)`)

// ---------- parse the transaction report ----------
const tRows = parseCsv(readFileSync(args.txn, 'utf8').replace(/^﻿/, ''))
const tHdr = tRows.find((r) => r.includes('Type') && r.includes('Net amount'))
if (!tHdr) die('transaction report: could not find the header row')
const ti = (name) => tHdr.indexOf(name)
const T = { type: ti('Type'), order: ti('Order number'), item: ti('Item ID'), net: ti('Net amount'), sub: ti('Item subtotal'), ship: ti('Shipping and handling'), fvfF: ti('Final Value Fee - fixed'), fvfV: ti('Final Value Fee - variable'), intl: ti('International fee'), reg: ti('Regulatory operating fee'), desc: ti('Description') }
const tData = tRows.slice(tRows.indexOf(tHdr) + 1)

const txnOrders = {}, labels = {}
let refunds = 0, refundCount = 0, claim = 0, adjustment = 0
let storeSub = 0, gallery = 0, insertion = 0
const promoGeneral = {}, promoOffsite = {}
for (const r of tData) {
  const type = g(r, T.type).trim()
  const net = money(g(r, T.net))
  const order = g(r, T.order).trim()
  const item = g(r, T.item).trim()
  const desc = g(r, T.desc)
  if (type === 'Order') {
    ;(txnOrders[order] ||= []).push({ item, sub: money(g(r, T.sub)), ship: money(g(r, T.ship)), fvfF: -money(g(r, T.fvfF)), fvfV: -money(g(r, T.fvfV)), intl: -money(g(r, T.intl)), reg: -money(g(r, T.reg)) })
  } else if (type === 'Shipping label') {
    labels[order] = r2((labels[order] || 0) - net) // net is negative; store cost as positive
  } else if (type === 'Refund') { refunds = r2(refunds + net); refundCount++ }
  else if (type === 'Claim') claim = r2(claim + net)
  else if (type === 'Adjustment') adjustment = r2(adjustment + net)
  else if (type === 'Other fee') {
    if (/subscription/i.test(desc)) storeSub = r2(storeSub - net)
    else if (/gallery|listing upgrade/i.test(desc)) gallery = r2(gallery - net)
    else if (/insertion/i.test(desc)) insertion = r2(insertion - net)
    else if (/promoted listings/i.test(desc)) promoGeneral[item] = r2((promoGeneral[item] || 0) - net)
    else if (/promoted offsite/i.test(desc)) promoOffsite[item] = r2((promoOffsite[item] || 0) - net)
    else console.log(`  note: unclassified Other fee ${net} (${desc.slice(0, 50)}) — counted in offsite bucket`), (promoOffsite[item || '_misc'] = r2((promoOffsite[item || '_misc'] || 0) - net))
  }
  // Payout / Charge / Transfer / Hold rows are bank movements, not P&L — skipped.
}

// ---------- HARD RECONCILIATION GATE ----------
const problems = []
for (const o of monthOrders) {
  const t = txnOrders[o.order]
  if (!t) { problems.push(`order ${o.order} (${o.title.slice(0, 40)}) is in the orders CSV but NOT in the transaction report`); continue }
  const tSub = r2(t.reduce((a, x) => a + x.sub, 0))
  const tShip = r2(t.reduce((a, x) => a + x.ship, 0))
  if (Math.abs(tSub - o.sale) > 0.005) problems.push(`order ${o.order}: item price ${o.sale} (orders CSV) vs ${tSub} (transaction report)`)
  if (Math.abs(tShip - o.ship) > 0.005) problems.push(`order ${o.order}: shipping ${o.ship} (orders CSV) vs ${tShip} (transaction report)`)
}
for (const order of Object.keys(txnOrders)) {
  if (!monthOrders.some((o) => o.order === order)) problems.push(`order ${order} is in the transaction report but NOT in the orders CSV — re-export the orders report covering the full month`)
}
if (problems.length) die('RECONCILIATION FAILED — nothing written:\n  - ' + problems.join('\n  - '))
console.log(`  reconciled: every order matches to the penny across both reports`)

// ---------- sport classification ----------
const SPORT_RULES = [
  ['Non-Sport / Novelty', /star wars|sponge\s?bob|garbage pail|pok[eé]mon|magic the gathering|\bmtg\b|yu-?gi-?oh/i],
  ['Football', /football|\bnfl\b|\bsage\b|packers|eagles|colts|broncos|bears|steelers|cowboys|49ers|niners|bills\b|chiefs|ravens|bengals|browns|texans|jaguars|titans|jets\b|dolphins|patriots|commanders|lions\b|vikings|saints|falcons|panthers|buccaneers|seahawks|chargers|raiders|\brams\b|penn state|ohio state|heisman/i],
  ['Basketball', /basketball|\bnba\b|\bwnba\b|hoops|prizm draft|lakers|celtics|bucks\b|bulls\b|knicks|nets\b|heat\b|warriors|suns\b|mavericks|nuggets|clippers|grizzlies|pelicans|thunder|timberwolves|cavaliers|pistons|pacers|magic\b|hawks\b|raptors|rockets|spurs|kings\b|jazz\b|hornets|wizards|trail blazers/i],
  ['Soccer', /soccer|\bfifa\b|premier league|\bmls\b|futbol/i],
  ['Baseball', /baseball|\bmlb\b|bowman|topps chrome(?! football)|heritage|allen & ginter|ginter|topps update|pro debut|cosmic chrome|inception|topps series|topps holiday|red sox|yankees|dodgers|padres|mets\b|braves|astros|phillies|cubs\b|cardinals|brewers|orioles|guardians|tigers\b|twins\b|royals|white sox|rays\b|blue jays|mariners|rangers|angels|athletics|giants\b|rockies|diamondbacks|nationals|marlins|pirates|reds\b/i],
]
const classifySport = (o) => {
  if (sportsOverride[o.item_id]) return sportsOverride[o.item_id]
  for (const [sport, re] of SPORT_RULES) if (re.test(o.title)) return sport
  return null
}
const unclassified = monthOrders.filter((o) => !classifySport(o))
if (unclassified.length) die('cannot classify sport for:\n' + unclassified.map((o) => `  ${o.item_id}  ${o.title}`).join('\n') + '\nPass --sports overrides.json with {"item_id": "Sport"} for these.')

// ---------- build card records ----------
const SUP = 0.65
const mask = (order) => {
  const digits = order.replace(/\D/g, '')
  const keepFrom = Math.max(0, digits.length - 4)
  let seen = 0
  return order.replace(/\d/g, (d) => (seen++ >= keepFrom ? d : '•'))
}
const band = (v) => (v < 5 ? '<$5' : v < 20 ? '$5–20' : v < 50 ? '$20–50' : v < 100 ? '$50–100' : '$100+')
const SERVICE_NAMES = { ESUS: 'eBay Standard Envelope' }
const newCards = monthOrders.map((o) => {
  const t = txnOrders[o.order]
  const fvf = r2(t.reduce((a, x) => a + x.fvfF + x.fvfV, 0))
  const postage = labels[o.order] != null ? labels[o.order] : null
  const promo = promoGeneral[o.item_id] || 0
  const offsite = promoOffsite[o.item_id] || 0
  const fees = r2(fvf + promo + offsite + (postage ?? 0))
  const net = r2(o.sale + o.ship - fees)
  const nas = r2(net - SUP)
  const bucket = nas < 0 ? (net > 0 ? 'supplies_tipped' : 'below') : null
  const service = postage == null ? '—' : postage <= 2 ? 'eBay Standard Envelope' : 'USPS Ground Advantage'
  const why =
    bucket === 'supplies_tipped'
      ? `Cleared about $0 on eBay ($${net.toFixed(2)}), then the $0.65 supplies cost tipped it to −$${Math.abs(nas).toFixed(2)}.`
      : bucket === 'below'
        ? `Sold for only $${o.sale.toFixed(2)}. Fees of $${fees.toFixed(2)} plus supplies outran the sale, netting −$${Math.abs(nas).toFixed(2)}.`
        : nas < 3
          ? `Thin margin — $${o.sale.toFixed(2)} sale left $${nas.toFixed(2)} after $${fees.toFixed(2)} fees and $0.65 supplies.`
          : `Solid sale ($${o.sale.toFixed(2)}) with fees at ${((fees / o.sale) * 100).toFixed(2)}%, netting $${net.toFixed(2)}.`
  return {
    title: o.title, item_id: o.item_id, sport: classifySport(o), month: MONTH,
    date: `${MONTH} ${o.day}, ${YEAR}`, qty: 1, item_sales: o.sale, ship: o.ship,
    fees, fvf, net, supplies: SUP, nas, band: band(o.sale),
    channel: o.promoted ? 'Promoted' : 'Straight', bucket, order: mask(o.order),
    postage, service, shipMargin: postage == null ? null : r2(o.ship - postage),
    feePct: o.sale ? Math.round((fees / o.sale) * 100) : 0, why,
  }
})

// labels bought this month for PRIOR months' orders: attach to their cards
const priorCards = [] // cards from earlier months whose label was bought this month
const priorLabels = Object.entries(labels).filter(([order]) => !monthOrders.some((o) => o.order === order))
for (const [order, cost] of priorLabels) {
  const suffix = order.replace(/\D/g, '').slice(-4)
  const card = D.cards.find((c) => c.order.endsWith(suffix) && c.postage == null)
  if (!card) { console.log(`  note: $${cost} label for prior-month order …${suffix} — no unlabeled card found, counted in ledger only`); continue }
  card.postage = cost
  card.service = cost <= 2 ? 'eBay Standard Envelope' : 'USPS Ground Advantage'
  card.fees = r2(card.fees + cost)
  card.net = r2(card.net - cost)
  card.nas = r2(card.nas - cost)
  card.shipMargin = r2(card.ship - cost)
  card.feePct = card.item_sales ? Math.round((card.fees / card.item_sales) * 100) : 0
  const sp = D.sport[card.sport]
  if (sp) { sp.net = r2(sp.net - cost); sp.selling_costs = r2(sp.selling_costs + cost); sp.net_after_supplies = r2(sp.net_after_supplies - cost) }
  D.shippingAnalysis.distribution[card.shipMargin < -0.25 ? 'lose' : card.shipMargin > 0.25 ? 'win' : 'even'] += 1
  priorCards.push(card)
  console.log(`  prior-month label $${cost} attached to: ${card.title.slice(0, 50)}`)
}

// ---------- monthly row ----------
const sum = (f) => r2(monthOrders.reduce((a, o) => a + o[f], 0))
const item_sales = sum('sale'), ship_charged = sum('ship')
const fvf_fixed = r2(Object.values(txnOrders).flat().reduce((a, x) => a + x.fvfF, 0))
const fvf_var = r2(Object.values(txnOrders).flat().reduce((a, x) => a + x.fvfV, 0))
const international = r2(Object.values(txnOrders).flat().reduce((a, x) => a + x.intl, 0))
const regulatory = r2(Object.values(txnOrders).flat().reduce((a, x) => a + x.reg, 0))
const promo_general_total = r2(Object.values(promoGeneral).reduce((a, v) => a + v, 0))
const promo_offsite_total = r2(Object.values(promoOffsite).reduce((a, v) => a + v, 0))
const postage_ledger = r2(Object.values(labels).reduce((a, v) => a + v, 0))
const per_sale = r2(fvf_fixed + fvf_var + promo_general_total + promo_offsite_total + international + regulatory)
const listing = r2(insertion + gallery)
const full_ledger = r2(per_sale + listing + storeSub + postage_ledger)
const supplies = r2(newCards.length * D.meta.supplies_per_card)
const net_proceeds = r2(item_sales + ship_charged - full_ledger + refunds + claim + adjustment)
const monthly = {
  month: MONTH, orders: monthOrders.length, cards_net: newCards.length,
  item_sales, ship_charged, fvf_fixed, fvf_var,
  promo_offsite: promo_offsite_total, promo_general: promo_general_total,
  insertion, gallery, international, regulatory, store_sub: storeSub,
  adjustment, postage: postage_ledger, supplies,
  per_sale_fees: per_sale, listing_fees: listing, item_scoped_fees: per_sale,
  full_ledger_fees: full_ledger, refunds, refund_count: refundCount, claim,
  net_proceeds, net_after_supplies: r2(net_proceeds - supplies),
  aov: r2((item_sales + ship_charged) / monthOrders.length),
  asp: r2(item_sales / newCards.length),
  fee_load: r2(((full_ledger + supplies) / item_sales) * 100),
  ship_pl: r2(ship_charged - postage_ledger),
}

// ---------- roll up ----------
D.months.push(MONTH)
D.monthly.push(monthly)
const H = D.H1
const bump = (f, v) => { H[f] = r2((H[f] || 0) + v) }
for (const f of ['orders', 'cards_net', 'item_sales', 'ship_charged', 'fvf_fixed', 'fvf_var', 'promo_offsite', 'promo_general', 'insertion', 'gallery', 'international', 'regulatory', 'store_sub', 'adjustment', 'postage', 'supplies', 'per_sale_fees', 'listing_fees', 'item_scoped_fees', 'full_ledger_fees', 'refunds', 'refund_count', 'claim', 'net_proceeds', 'net_after_supplies', 'ship_pl'])
  bump(f, monthly[f])
H.asp = r2(H.item_sales / H.cards_net)
H.aov = r2((H.item_sales + H.ship_charged) / H.orders)
H.fee_load = r2(((H.full_ledger_fees + H.supplies) / H.item_sales) * 100)
H.take_rate = r2((H.full_ledger_fees / (H.item_sales + H.ship_charged)) * 100)

for (const c of newCards) {
  const sp = (D.sport[c.sport] ||= { cards: 0, item_sales: 0, net: 0, selling_costs: 0, supplies: 0, net_after_supplies: 0 })
  sp.cards += 1
  sp.item_sales = r2(sp.item_sales + c.item_sales)
  sp.net = r2(sp.net + c.net)
  sp.selling_costs = r2(sp.selling_costs + c.fees)
  sp.supplies = r2(sp.supplies + c.supplies)
  sp.net_after_supplies = r2(sp.net_after_supplies + c.nas)
}
D.channels['Promoted listing'] = (D.channels['Promoted listing'] || 0) + newCards.filter((c) => c.channel === 'Promoted').length
D.channels['Straight sale (no offer/promo)'] = (D.channels['Straight sale (no offer/promo)'] || 0) + newCards.filter((c) => c.channel === 'Straight').length
D.cards.push(...newCards)
D.top = [...D.cards].sort((a, b) => b.item_sales - a.item_sales).slice(0, 12)
  .map((c) => ({ title: c.title, sport: c.sport, item_sales: c.item_sales, net: c.net, selling_costs: c.fees, net_after_supplies: c.nas }))
for (const c of newCards) if (c.bucket) (D.lossBuckets[c.bucket] ||= []).push({ ...c })

const SA = D.shippingAnalysis
const labeled = newCards.filter((c) => c.postage != null)
SA.totalCharged = r2(SA.totalCharged + ship_charged)
SA.totalPostage = r2(SA.totalPostage + postage_ledger)
SA.net = r2(SA.totalCharged - SA.totalPostage)
SA.labeledOrders += labeled.length + priorCards.length
SA.avgCostPerCard = r2(SA.totalPostage / SA.labeledOrders)
const svcAdd = (name, cs, xPost = 0, xChg = 0, xOrd = 0) => {
  const row = SA.byService.find((x) => x.service === name)
  if (!row) return
  row.orders += cs.length + xOrd
  row.totPostage = r2(row.totPostage + cs.reduce((a, c) => a + c.postage, 0) + xPost)
  row.totCharged = r2(row.totCharged + cs.reduce((a, c) => a + c.ship, 0) + xChg)
  row.avgPostage = r2(row.totPostage / row.orders)
  row.avgCharged = r2(row.totCharged / row.orders)
  row.avgMargin = r2((row.totCharged - row.totPostage) / row.orders)
}
const priorEse = priorCards.filter((c) => /Envelope/.test(c.service)), priorGa = priorCards.filter((c) => /Ground/.test(c.service))
svcAdd('eBay Standard Envelope', labeled.filter((c) => /Envelope/.test(c.service)), r2(priorEse.reduce((a, c) => a + c.postage, 0)), r2(priorEse.reduce((a, c) => a + c.ship, 0)), priorEse.length)
svcAdd('USPS Ground Advantage', labeled.filter((c) => /Ground/.test(c.service)), r2(priorGa.reduce((a, c) => a + c.postage, 0)), r2(priorGa.reduce((a, c) => a + c.ship, 0)), priorGa.length)
for (const c of labeled) SA.distribution[c.shipMargin < -0.25 ? 'lose' : c.shipMargin > 0.25 ? 'win' : 'even'] += 1

const F = D.fees_h1
const fbump = (k, v) => { F[k] = r2((F[k] || 0) + v) }
fbump('Final Value Fee (variable)', fvf_var); fbump('Final Value Fee (fixed)', fvf_fixed)
fbump('Shipping labels', postage_ledger); fbump('Promoted Offsite ads', promo_offsite_total)
fbump('Promoted Listings ads', promo_general_total); fbump('Store subscription', storeSub)
fbump('Gallery Plus / upgrades', gallery); fbump('Insertion fees', insertion)
fbump('International fee', international); fbump('Regulatory operating fee', regulatory)

const monthEnd = new Date(YEAR, MONTH_SEQ.indexOf(MONTH) + 1, 0).getDate()
Object.assign(D.meta, {
  period: `Jan 1 – ${MONTH} ${monthEnd}, ${YEAR}`,
  period_short: `${YEAR} YTD`,
  generated: new Date().toISOString().slice(0, 10),
  last_month: MONTH,
  prev_month: MONTH_SEQ[MONTH_SEQ.indexOf(MONTH) - 1],
  data_through: `${MONTH} ${monthEnd}, ${YEAR}`,
})

// ---------- optional traffic refresh (--traffic csv --traffic-window "Jul 1 – Jul 31, 2026") ----------
if (args.traffic) {
  if (!args['traffic-window']) die('--traffic requires --traffic-window "Jul 1 – Jul 31, 2026" (the label shown on the site)')
  const rows = parseCsv(readFileSync(args.traffic, 'utf8').replace(/^﻿/, ''))
  const hi = rows.findIndex((r) => r.filter((c) => /impression|page view|click|quantity sold|conversion/i.test(c)).length >= 2)
  if (hi < 0) die('traffic CSV: no recognizable header row (need impression/page view/sold columns)')
  const hdr = rows[hi].map((c) => c.toLowerCase())
  const colSum = (test, exclude = /$^/) => {
    let tot = 0, found = false
    hdr.forEach((h, i) => {
      if (test.test(h) && !exclude.test(h)) {
        found = true
        for (const r of rows.slice(hi + 1)) tot += money(r[i])
      }
    })
    return found ? tot : null
  }
  const impressions = colSum(/impression/, /promoted|organic|off/)
  const views = colSum(/page view|listing view/)
  const sold = colSum(/quantity sold|sold/)
  const organic = colSum(/organic impression|organic/)
  const promoted = colSum(/promoted listing|promoted impression/, /off/)
  const offsite = colSum(/off.?ebay|offsite/)
  if (impressions == null || views == null) die('traffic CSV: could not find impressions/page-view columns. Headers seen:\n  ' + hdr.join(' | '))
  const prev = D.traffic || {}
  const pd = (cur, old) => (old ? r2(((cur - old) / old) * 100) : null)
  const ctr = r2((views / impressions) * 100), conv = views ? r2(((sold || 0) / views) * 100) : 0
  D.traffic = {
    window: args['traffic-window'], compare: prev.window ? `vs ${prev.window}` : 'first tracked window',
    impressions: Math.round(impressions), impressions_delta: pd(impressions, prev.impressions),
    views: Math.round(views), views_delta: pd(views, prev.views),
    sold: Math.round(sold || 0), sold_delta: pd(sold, prev.sold),
    ctr, ctr_delta: pd(ctr, prev.ctr),
    conv, conv_delta: pd(conv, prev.conv),
    sources: [
      promoted != null && { label: 'Promoted Listings', v: Math.round(promoted), note: 'paid — eBay ad fees', delta: pd(promoted, (prev.sources || []).find((s) => s.label === 'Promoted Listings')?.v) },
      organic != null && { label: 'Organic', v: Math.round(organic), note: 'free — search & browse', delta: pd(organic, (prev.sources || []).find((s) => s.label === 'Organic')?.v) },
      offsite != null && { label: 'Promoted Offsite', v: Math.round(offsite), note: 'paid — Google, etc.', delta: pd(offsite, (prev.sources || []).find((s) => s.label === 'Promoted Offsite')?.v) },
    ].filter(Boolean),
  }
  console.log(`  traffic refreshed: ${D.traffic.impressions.toLocaleString()} impressions, window ${D.traffic.window}`)
}

// ---------- self-checks (mirror the vitest suite) ----------
const near = (a, b, eps = 0.02) => Math.abs(a - b) < eps
const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0)
const checks = [
  ['monthly item_sales rolls up', near(sumBy(D.monthly, (m) => m.item_sales), H.item_sales)],
  ['monthly full_ledger_fees rolls up', near(sumBy(D.monthly, (m) => m.full_ledger_fees), H.full_ledger_fees)],
  ['monthly nas rolls up', near(sumBy(D.monthly, (m) => m.net_after_supplies), H.net_after_supplies)],
  ['waterfall closes', near(H.net_proceeds - H.supplies, H.net_after_supplies)],
  ['every card nas consistent', D.cards.every((c) => near(c.item_sales + c.ship - c.fees - c.supplies, c.nas))],
  ['no PII fields', !/"(city|state)"\s*:/.test(JSON.stringify(D))],
  ['all orders masked', D.cards.every((c) => /^••-/.test(c.order))],
]
let ok = true
for (const [name, pass] of checks) { console.log((pass ? '  PASS ' : '  FAIL ') + name); ok &&= pass }
if (!ok) die('self-checks failed — nothing written')

// ---------- write scrubbed json, pins, and re-encrypt ----------
writeFileSync(SCRUB_OUT, JSON.stringify(D))
writeFileSync(PINS_OUT, JSON.stringify({ net_after_supplies: H.net_after_supplies, cards: D.cards.length, orders: H.orders, months: D.monthly.map((m) => m.month) }, null, 2) + '\n')
const salt = randomBytes(16), iv = randomBytes(12)
const key = pbkdf2Sync(PASSWORD, salt, 250000, 32, 'sha256')
const cipher = createCipheriv('aes-256-gcm', key, iv)
const pt = Buffer.from(JSON.stringify(D), 'utf8')
const ct2 = Buffer.concat([cipher.update(pt), cipher.final(), cipher.getAuthTag()])
writeFileSync(BLOB_OUT, JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: 250000, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct2.toString('base64') }))

console.log(`\nDONE — ${MONTH} ${YEAR} added.`)
console.log(`  YTD: ${D.cards.length} cards / ${H.orders} orders / $${H.item_sales} item sales / $${H.net_after_supplies} net after supplies`)
console.log(`  ${MONTH}: $${item_sales} sales, $${full_ledger} full-ledger costs, $${monthly.net_after_supplies} kept${refunds || claim ? `, refunds ${refunds} claim ${claim}` : ''}`)
console.log(`\nNext: npx vitest run   → then commit public/ccsc-data.enc.json + test/pins.json and push.`)
