import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CCSC_DATA as D } from '../data/ccsc-data.js'
import { usd, usd2, signed } from '../lib/format.js'
import {
  DEFAULT_COST_MODEL,
  acqCost,
  isModeling,
  modelLabel as modelLabelOf,
} from '../lib/costModel.js'
import SectionHeader from '../components/SectionHeader.jsx'
import CostModelControl from '../components/CostModelControl.jsx'
import CardDetailModal from '../components/CardDetailModal.jsx'

const ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const qOf = (m) => (ORDER.indexOf(m) < 3 ? 'Q1' : 'Q2')

function sportColor(s) {
  if (/Baseball/.test(s)) return ['#DCEAE0', '#1B5E43']
  if (/Basketball/.test(s)) return ['#F3E1D2', '#B4531F']
  if (/Football/.test(s)) return ['#E2E0D2', '#6B6459']
  return ['#EDE6D5', '#8A8272']
}

const thStyle = {
  textAlign: 'right',
  padding: '12px 10px',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  color: '#6B6459',
}

export default function FullBreakdown() {
  const [cm, setCm] = useState(DEFAULT_COST_MODEL)
  const [search, setSearch] = useState('')
  const [monthF, setMonthF] = useState('All')
  const [sportF, setSportF] = useState('All')
  const [sort, setSort] = useState({ key: 'sale', dir: -1 })
  const [detailId, setDetailId] = useState(null)

  const meta = D.meta
  const cards = D.cards
  const MON = D.monthly
  const monthing = isModeling(cm)
  const modelLabel = modelLabelOf(cm)

  // ---- per-card modeled acquisition, grouped by month ----
  const { cardAcq, totAcq } = useMemo(() => {
    const cardAcq = {}
    let totAcq = 0
    cards.forEach((c) => {
      const a = acqCost(c, cm)
      cardAcq[c.month] = (cardAcq[c.month] || 0) + a
      totAcq += a
    })
    return { cardAcq, totAcq }
  }, [cards, cm])

  // ---- MONTHLY (authoritative ledger from MON) ----
  const monthRows = useMemo(() => {
    const byMon = {}
    MON.forEach((m) => (byMon[m.month] = m))
    return ORDER.map((mo) => {
      const m = byMon[mo]
      if (!m) return null
      const acqM = cardAcq[mo] || 0
      const net = m.net_after_supplies
      const profit = net - acqM
      return {
        name: mo,
        q: qOf(mo),
        cards: m.cards_net,
        sales: usd2(m.item_sales),
        fees: usd2(m.full_ledger_fees),
        supplies: usd2(m.supplies),
        ship: signed(m.ship_pl),
        shipColor: m.ship_pl < 0 ? '#B4531F' : '#1B5E43',
        net: usd2(net),
        cost: monthing ? usd2(acqM) : '—',
        profit: monthing ? usd2(profit) : usd2(net),
        profitColor: monthing ? (profit < 0 ? '#B4531F' : '#1B5E43') : '#1B5E43',
      }
    }).filter(Boolean)
  }, [MON, cardAcq, monthing])

  const sum = (f) => MON.reduce((a, m) => a + m[f], 0)
  const totNet = sum('net_after_supplies')
  const tot = {
    cards: sum('cards_net'),
    sales: usd2(sum('item_sales')),
    fees: usd2(sum('full_ledger_fees')),
    supplies: usd2(sum('supplies')),
    ship: signed(sum('ship_pl')),
    net: usd2(totNet),
    cost: monthing ? usd2(totAcq) : '—',
    profit: monthing ? usd2(totNet - totAcq) : usd2(totNet),
  }

  // ---- KPIs ----
  const feePct = (sum('full_ledger_fees') / sum('item_sales')) * 100
  const kpis = [
    { label: 'Cards sold', val: String(sum('cards_net')), sub: 'across ' + sum('orders') + ' orders', color: '#221F1A' },
    { label: 'Item sales', val: usd(sum('item_sales')), sub: 'before any costs', color: '#221F1A' },
    { label: 'Total costs', val: usd(sum('full_ledger_fees') + sum('supplies')), sub: feePct.toFixed(0) + '% of sales', color: '#B4531F' },
    { label: 'Net kept', val: usd(totNet), sub: 'after eBay fees + supplies', color: '#1B5E43' },
    {
      label: monthing ? 'Modeled profit' : 'Card cost',
      val: monthing ? usd(totNet - totAcq) : 'not set',
      sub: monthing ? 'after ' + modelLabel.toLowerCase() : 'pick a model above',
      color: monthing ? '#164A35' : '#8A8272',
    },
  ]

  // ---- QUARTERLY ----
  const qAgg = (q) => {
    const ms = MON.filter((m) => qOf(m.month) === q)
    const s = (f) => ms.reduce((a, m) => a + m[f], 0)
    const sales = s('item_sales'), net = s('net_after_supplies'), cardsN = s('cards_net')
    const costs = s('full_ledger_fees') + s('supplies')
    const acq = ms.reduce((a, m) => a + (cardAcq[m.month] || 0), 0)
    return { sales, net, cards: cardsN, costs, acq, asp: sales / cardsN, margin: (net / sales) * 100 }
  }
  const q1 = qAgg('Q1'), q2 = qAgg('Q2')
  const qStat = (q) => {
    const base = [
      { label: 'Item sales', val: usd(q.sales) },
      { label: 'Cards sold', val: String(q.cards) },
      { label: 'Avg price', val: usd2(q.asp) },
      { label: 'Net kept', val: usd(q.net) },
      { label: 'Costs', val: usd(q.costs) },
      { label: 'Net margin', val: q.margin.toFixed(0) + '%' },
    ]
    if (monthing) base.push({ label: 'Modeled profit', val: usd(q.net - q.acq) })
    return base
  }
  const quarters = [
    { name: 'Q1', span: 'Jan – Mar', bg: '#164A35', bd: '#123C2B', fg: '#F4EFDF', stats: qStat(q1) },
    { name: 'Q2', span: 'Apr – Jun', bg: '#FBF9F4', bd: '#E0D8C7', fg: '#221F1A', stats: qStat(q2) },
  ]
  const delta = (a, b) => ((b - a) / a) * 100
  const mkD = (label, a, b, note, invert) => {
    const d = delta(a, b)
    const good = invert ? d < 0 : d > 0
    return { label, pct: Math.abs(d).toFixed(0) + '%', arrow: d >= 0 ? '▲' : '▼', color: good ? '#1B5E43' : '#B4531F', note }
  }
  const qDeltas = [
    mkD('Item sales', q1.sales, q2.sales, 'Q1 rode January'),
    mkD('Cards sold', q1.cards, q2.cards, 'more volume in Q2', false),
    mkD('Avg price', q1.asp, q2.asp, 'half the price point'),
    mkD('Net margin', q1.margin, q2.margin, 'costs ate more of each sale'),
  ]

  // ---- BY CARD ----
  const monthChips = ['All', ...ORDER].map((m) => ({ label: m, active: monthF === m, on: () => setMonthF(m) }))
  const sportChips = ['All', 'Baseball', 'Football', 'Basketball', 'Other'].map((s) => ({
    label: s,
    active: sportF === s,
    on: () => setSportF(s),
  }))

  const rows = useMemo(() => {
    const q = (search || '').toLowerCase()
    const sportMatch = (c) => {
      if (sportF === 'All') return true
      if (sportF === 'Other') return !/Baseball|Football|Basketball/.test(c.sport)
      return c.sport === sportF
    }
    let out = cards
      .filter(
        (c) =>
          (monthF === 'All' || c.month === monthF) &&
          sportMatch(c) &&
          (!q || c.title.toLowerCase().includes(q))
      )
      .map((c) => {
        const a = acqCost(c, cm)
        return { c, sale: c.item_sales, fees: c.fees, supplies: c.supplies, net: c.nas, cost: a, profit: c.nas - a }
      })
    const { key, dir } = sort
    out.sort((x, y) => (x[key] < y[key] ? -1 : x[key] > y[key] ? 1 : 0) * dir)
    return out
  }, [cards, search, monthF, sportF, sort, cm])

  const caret = (key) => (sort.key === key ? (sort.dir < 0 ? ' ↓' : ' ↑') : '')
  const cols = [
    { label: 'Card', key: 'title', align: 'left' },
    { label: 'Sport', key: 'sport', align: 'left' },
    { label: 'Mo', key: 'month', align: 'left' },
    { label: 'Sale', key: 'sale', align: 'right' },
    { label: 'Fees', key: 'fees', align: 'right' },
    { label: 'Supp.', key: 'supplies', align: 'right' },
    { label: 'Net kept', key: 'net', align: 'right' },
    { label: 'Cost', key: 'cost', align: 'right' },
    { label: 'Profit', key: 'profit', align: 'right' },
  ]

  const shownNetV = rows.reduce((a, r) => a + r.net, 0)
  const shownProfitV = rows.reduce((a, r) => a + (monthing ? r.profit : r.net), 0)

  // ---- TRAFFIC (from YTD report, 30-day window) ----
  const trafficKpis = [
    { label: 'Impressions', val: '592,419', arrow: '▼', delta: '2.2%', color: '#B4531F' },
    { label: 'Listing views', val: '1,580', arrow: '▲', delta: '36.8%', color: '#1B5E43' },
    { label: 'Cards sold', val: '15', arrow: '▼', delta: '11.8%', color: '#B4531F' },
    { label: 'Click-through', val: '0.2%', arrow: '▲', delta: '11.8%', color: '#1B5E43' },
    { label: 'Conversion', val: '0.9%', arrow: '▼', delta: '35.5%', color: '#B4531F' },
  ]
  const T = 592419
  const sources = [
    { label: 'Promoted Listings', v: 424380, color: '#B4531F', note: 'paid — eBay ad fees', delta: '▼12.6%', dColor: '#B4531F' },
    { label: 'Organic', v: 127805, color: '#1B5E43', note: 'free — search & browse', delta: '▲5.9%', dColor: '#1B5E43' },
    { label: 'Promoted Offsite', v: 40234, color: '#C99A6A', note: 'paid — Google, etc.', delta: 'flat', dColor: '#8A8272' },
  ].map((s) => ({ ...s, pct: (s.v / T) * 100, pctLabel: ((s.v / T) * 100).toFixed(0) + '%' }))

  const st = D.funnel.primary.stages
  const ctr = st.find((s) => /Click/.test(s.label))
  const conv = st.find((s) => /conversion|Sales conv/i.test(s.label))
  const funnelBars = [
    { label: 'Impressions / listing / day', you: '23', top: '—', youW: 60, topW: 0 },
    {
      label: 'Click-through rate',
      you: (ctr ? ctr.you : 0.24) + '%',
      top: (ctr ? ctr.top10 : 1.69) + '%',
      youW: ((ctr ? ctr.you : 0.24) / (ctr ? ctr.top10 : 1.69)) * 100,
      topW: 100,
    },
    {
      label: 'Sales conversion',
      you: (conv ? conv.you : 1.69) + '%',
      top: (conv ? conv.top10 : 9.34) + '%',
      youW: ((conv ? conv.you : 1.69) / (conv ? conv.top10 : 9.34)) * 100,
      topW: 100,
    },
  ]

  const detailCard = detailId ? cards.find((x) => x.item_id === detailId) : null

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 22px 90px' }}>
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          padding: '24px 0 16px',
          borderBottom: '1px solid #D3C9B6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 11,
              background: '#1B5E43',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F4EFDF',
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: '-.5px',
            }}
          >
            CC
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.4px', lineHeight: 1.1 }}>{meta.seller}</div>
            <div style={{ fontSize: 12.5, color: '#6B6459', marginTop: 2 }}>
              Full cost breakdown, card by card · <span className="tnum">{meta.period}</span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: '#FBF9F4',
            border: '1px solid #E0D8C7',
            borderRadius: 9,
            padding: '7px 11px',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1B5E43' }} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: '#8A8272', fontWeight: 700 }}>
              Data through
            </div>
            <div className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>Jun 30, 2026</div>
          </div>
        </div>
      </div>

      {/* COST-BASIS BANNER */}
      <div
        className="lift"
        style={{
          marginTop: 22,
          background: '#FBF3E8',
          border: '1px solid #E4C9A6',
          borderLeft: '4px solid #B4531F',
          borderRadius: 13,
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A4A1C' }}>
            One number is missing: what you paid for the cards
          </div>
        </div>
        <p style={{ margin: '9px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#5C4326', maxWidth: 860 }}>
          eBay's reports show every dollar <b>in</b> and every fee <b>out</b> — but not your <b>acquisition cost</b> (what you
          paid for each card). That's still "to be provided" in your records. So every figure below is real <b>except</b>{' '}
          profit, which is <b>modeled</b> from the cost assumption you pick in the <b>Cost model</b> control below. Set it to
          "Net after fees" for hard numbers only, or model a cost to preview true profit. Drop in real per-card costs and it
          becomes exact.
        </p>
        <div
          style={{
            marginTop: 11,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid #E4C9A6',
            borderRadius: 8,
            padding: '7px 12px',
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A8272' }}>
            Now modeling
          </span>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: '#B4531F' }}>{modelLabel}</span>
        </div>
      </div>

      {/* COST MODEL CONTROL (replaces the prototype's Tweaks panel) */}
      <CostModelControl cm={cm} onChange={setCm} />

      {/* TOP-LINE STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="lift" style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '15px 17px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.6px', marginTop: 7, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: '#8A8272', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ================= MONTHLY ================= */}
      <section style={{ marginTop: 40 }}>
        <SectionHeader n={1} title="Month by month" />
        <p style={{ fontSize: 13.5, color: '#524B3F', lineHeight: 1.6, maxWidth: 760, margin: '10px 0 16px' }}>
          Every dollar that came in, every cost that came out, and what was left — for each month of H1.{' '}
          <span style={{ color: '#8A8272' }}>
            Fees are the full ledger (per-sale + fixed store &amp; listing). "Modeled profit" subtracts the cost assumption
            above.
          </span>
        </p>

        <div style={{ overflowX: 'auto', border: '1px solid #E0D8C7', borderRadius: 14, background: '#FBF9F4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr style={{ background: '#F1EBDD', borderBottom: '2px solid #E0D8C7' }}>
                <th style={{ ...thStyle, textAlign: 'left', padding: '12px 14px' }}>Month</th>
                <th style={thStyle}>Cards</th>
                <th style={thStyle}>Item sales</th>
                <th style={thStyle}>eBay fees</th>
                <th style={thStyle}>Supplies</th>
                <th style={thStyle}>Ship P/L</th>
                <th style={thStyle}>Net kept</th>
                <th style={thStyle}>Card cost</th>
                <th style={{ ...thStyle, padding: '12px 14px' }}>Modeled profit</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((m) => (
                <tr key={m.name} className="rowh" style={{ borderBottom: '1px solid #EDE6D5' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 700 }}>
                    {m.name}
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8A8272', marginLeft: 6 }}>{m.q}</span>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13 }}>{m.cards}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, fontWeight: 600 }}>{m.sales}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, color: '#B4531F' }}>{m.fees}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, color: '#8A8272' }}>{m.supplies}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, color: m.shipColor }}>{m.ship}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, fontWeight: 700, color: '#1B5E43' }}>{m.net}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 10px', fontSize: 13, color: '#6B6459' }}>{m.cost}</td>
                  <td className="tnum" style={{ textAlign: 'right', padding: '12px 14px', fontSize: 13.5, fontWeight: 700, color: m.profitColor }}>{m.profit}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#164A35', color: '#F4EFDF' }}>
                <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 800 }}>H1 total</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700 }}>{tot.cards}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700 }}>{tot.sales}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700, color: '#F0C9A8' }}>{tot.fees}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700, color: '#C4D6CB' }}>{tot.supplies}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700, color: '#C4D6CB' }}>{tot.ship}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 800 }}>{tot.net}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 10px', fontSize: 13, fontWeight: 700, color: '#C4D6CB' }}>{tot.cost}</td>
                <td className="tnum" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 14, fontWeight: 800 }}>{tot.profit}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ================= QUARTERLY ================= */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={2} title="Q1 vs Q2 — a tale of two quarters" />
        <p style={{ fontSize: 13.5, color: '#524B3F', lineHeight: 1.6, maxWidth: 760, margin: '10px 0 18px' }}>
          Q1 was carried by a monster January. Q2 moved <b>more cards</b> but at <b>half the average price</b> — so costs ate a
          bigger share and margin compressed.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {quarters.map((q) => (
            <div key={q.name} className="lift" style={{ background: q.bg, border: '1px solid ' + q.bd, borderRadius: 15, padding: '20px 22px', color: q.fg }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{q.name}</div>
                <div style={{ fontSize: 11.5, opacity: 0.8 }}>{q.span}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 16px', marginTop: 16 }}>
                {q.stats.map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', opacity: 0.75, fontWeight: 700 }}>{s.label}</div>
                    <div className="tnum" style={{ fontSize: 19, fontWeight: 700, marginTop: 3 }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {qDeltas.map((d) => (
            <div key={d.label} style={{ flex: 1, minWidth: 170, background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '.5px' }}>{d.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                <span className="tnum" style={{ fontSize: 20, fontWeight: 700, color: d.color }}>
                  {d.arrow}
                  {d.pct}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#8A8272', marginTop: 3 }}>{d.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= BY CARD ================= */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={3} title="Every card, in full detail" />
        <p style={{ fontSize: 13.5, color: '#524B3F', lineHeight: 1.6, maxWidth: 760, margin: '10px 0 14px' }}>
          All <b className="tnum">{cards.length}</b> cards sold in H1. Filter, search, and sort — <b>click any card</b> for the
          full eBay-style order breakdown. <b>Net kept</b> is after eBay fees + supplies; <b>Profit</b> subtracts the modeled
          card cost.
        </p>

        {/* controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, alignItems: 'center', marginBottom: 12 }}>
          <input
            value={search}
            onInput={(e) => setSearch(e.target.value)}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search card or player…"
            style={{ flex: 1, minWidth: 200, padding: '9px 13px', border: '1px solid #D3C9B6', borderRadius: 9, background: '#FBF9F4', fontSize: 13, color: '#221F1A' }}
          />
          <div style={{ display: 'flex', gap: 4, background: '#EDE6D5', borderRadius: 9, padding: 3 }}>
            {monthChips.map((c) => (
              <button key={c.label} onClick={c.on} style={{ border: 'none', padding: '7px 11px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: c.active ? '#1B5E43' : 'transparent', color: c.active ? '#F4EFDF' : '#6B6459' }}>{c.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#EDE6D5', borderRadius: 9, padding: 3 }}>
            {sportChips.map((c) => (
              <button key={c.label} onClick={c.on} style={{ border: 'none', padding: '7px 11px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: c.active ? '#1B5E43' : 'transparent', color: c.active ? '#F4EFDF' : '#6B6459' }}>{c.label}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #E0D8C7', borderRadius: 14, background: '#FBF9F4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: '#F1EBDD', borderBottom: '2px solid #E0D8C7' }}>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : -1 }))}
                    style={{ textAlign: c.align, padding: '11px 12px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: sort.key === c.key ? '#1B5E43' : '#6B6459', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                  >
                    {c.label}
                    {caret(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const [sb, sf] = sportColor(r.c.sport)
                return (
                  <tr key={r.c.item_id} className="rowh" style={{ borderBottom: '1px solid #EDE6D5' }}>
                    <td style={{ padding: 0, maxWidth: 340 }}>
                      <button
                        onClick={() => setDetailId(r.c.item_id)}
                        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.35, color: '#221F1A', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'flex-start' }}
                      >
                        <span style={{ color: '#B4531F', flex: 'none' }}>⤢</span>
                        <span>{r.c.title}</span>
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: sb, color: sf }}>{r.c.sport.split(' ')[0]}</span>
                    </td>
                    <td className="tnum" style={{ padding: '10px 12px', fontSize: 12, color: '#6B6459' }}>{r.c.month}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12.5, fontWeight: 600 }}>{usd2(r.sale)}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#B4531F' }}>{usd2(r.fees)}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#8A8272' }}>{usd2(r.supplies)}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#1B5E43' }}>{usd2(r.net)}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#6B6459' }}>{monthing ? usd2(r.cost) : '—'}</td>
                    <td className="tnum" style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: monthing ? (r.profit < 0 ? '#B4531F' : '#1B5E43') : '#1B5E43' }}>{monthing ? usd2(r.profit) : usd2(r.net)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 12, color: '#8A8272' }}>
          <span>
            Showing <b className="tnum" style={{ color: '#221F1A' }}>{rows.length}</b> of {cards.length} cards
          </span>
          <span>
            Filtered net kept: <b className="tnum" style={{ color: '#1B5E43' }}>{usd2(shownNetV)}</b> · modeled profit:{' '}
            <b className="tnum" style={{ color: '#221F1A' }}>{monthing ? usd2(shownProfitV) : '—'}</b>
          </span>
        </div>
      </section>

      {/* ================= TRAFFIC ================= */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={4} title="The traffic story: you're renting your visibility" accent="#B4531F" />
        <p style={{ fontSize: 13.5, color: '#524B3F', lineHeight: 1.6, maxWidth: 820, margin: '10px 0 8px' }}>
          Here's the uncomfortable part. Nearly <b>three out of four impressions</b> you got last month were <b>paid</b> — eBay
          Promoted Listings — and that paid channel is <b>shrinking</b>. Your free, organic reach is small but it's the only
          source actually <b>growing</b>.
        </p>
        <p style={{ fontSize: 12, color: '#8A8272', lineHeight: 1.55, maxWidth: 820, margin: '0 0 16px' }}>
          eBay's year-to-date traffic export failed to load, so this is the most recent complete 30-day window (May 27 – Jun
          26), with each metric compared to the prior 30 days.
        </p>

        {/* traffic KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12 }}>
          {trafficKpis.map((t) => (
            <div key={t.label} className="lift" style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '15px 17px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6459', textTransform: 'uppercase', letterSpacing: '.5px' }}>{t.label}</div>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.5px', marginTop: 6 }}>{t.val}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: t.color }}>
                  {t.arrow}
                  {t.delta}
                </span>
                <span style={{ fontSize: 11, color: '#8A8272' }}>vs prior 30d</span>
              </div>
            </div>
          ))}
        </div>

        {/* sources split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginTop: 16 }}>
          <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 15, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Where your impressions come from</div>
            <div style={{ fontSize: 12, color: '#8A8272', marginBottom: 16 }}>
              <span className="tnum">592,419</span> impressions last month, by source
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 7, overflow: 'hidden', border: '1px solid #E0D8C7', marginBottom: 16 }}>
              {sources.map((s) => (
                <div key={s.label} style={{ width: s.pct + '%', background: s.color }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {sources.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: '#8A8272' }}>{s.note}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 'none' }}>
                    <div className="tnum" style={{ fontSize: 14, fontWeight: 700 }}>{s.pctLabel}</div>
                    <div className="tnum" style={{ fontSize: 11, color: s.dColor }}>{s.delta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#221F1A', borderRadius: 15, padding: '20px 22px', color: '#EDE7DB' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 14 }}>Seen a lot. Clicked rarely.</div>
            {funnelBars.map((f) => (
              <div key={f.label} style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                  <span style={{ color: '#C4BDAE' }}>{f.label}</span>
                  <span className="tnum" style={{ fontWeight: 700, color: '#fff' }}>{f.you}</span>
                </div>
                <div style={{ height: 8, background: '#3A362E', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: f.youW + '%', height: '100%', background: '#B4531F', borderRadius: 5 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 4, color: '#8A8272' }}>
                  <span>top sellers in your category</span>
                  <span className="tnum">{f.top}</span>
                </div>
                <div style={{ height: 6, background: '#3A362E', borderRadius: 5, overflow: 'hidden', marginTop: 3 }}>
                  <div style={{ width: f.topW + '%', height: '100%', background: '#4E8C6A', borderRadius: 5 }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: '#A79F8F', lineHeight: 1.5, marginTop: 4 }}>
              Listing views actually rose <b style={{ color: '#fff' }}>+37%</b> — when people find you, the listings work. The
              gap is getting found.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, background: '#F1EBDD', border: '1px solid #E0D8C7', borderRadius: 12, padding: '14px 17px', maxWidth: 900 }}>
          <span style={{ fontSize: 15, lineHeight: 1.3 }}>→</span>
          <p style={{ margin: 0, fontSize: 13, color: '#524B3F', lineHeight: 1.6 }}>
            <b>Contrast that matters:</b> paid impressions fell <b className="tnum">12.6%</b> while organic <b>grew</b>{' '}
            <b className="tnum">5.9%</b>. You're leaning on the channel that's declining and underusing the one that compounds
            for free. Every point of organic growth is margin you keep instead of rent you pay eBay.
          </p>
        </div>
      </section>

      {/* PER-CARD DETAIL MODAL */}
      {detailCard && <CardDetailModal card={detailCard} cm={cm} onClose={() => setDetailId(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 26, fontSize: 11.5, color: '#8A8272' }}>
        <span>
          Built from your eBay transaction ledger, orders &amp; listing-quality reports and the Jun 26 YTD traffic report ·{' '}
          <span className="tnum">{meta.period}</span>
        </span>
        <Link to="/summary" style={{ color: '#524B3F', fontWeight: 600 }}>
          ← Back to the summary
        </Link>
      </div>
    </div>
  )
}
