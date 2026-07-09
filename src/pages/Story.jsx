import { Link } from 'react-router-dom'
import { useData } from '../lib/dataContext.js'
import { usd, usd2 } from '../lib/format.js'
import SectionHeader from '../components/SectionHeader.jsx'

// Narrative "how the first half went" summary. Ported from the Story
// prototype's renderVals(). Rendered at the canonical Daylight/Fira look
// (the prototype's ambience/typeface tweaks were exploratory and omitted).
export default function Story() {
  const D = useData()
  const H = D.H1
  const M = D.monthly
  const meta = D.meta

  // Ch1 — bottom line
  const kept = H.net_after_supplies
  const keptCents = Math.round((kept / H.item_sales) * 100)
  const heroStats = [
    { val: H.orders + ' orders', label: H.cards_net + ' cards sold' },
    { val: usd2(H.asp), label: 'average card price' },
    { val: '100% positive', label: 'eBay feedback' },
  ]

  // Ch2 — flow of money in
  const moneyIn = H.item_sales + H.ship_charged
  const fees =
    H.fvf_var + H.fvf_fixed + H.promo_offsite + H.promo_general + H.insertion + H.gallery + H.international + H.regulatory + H.store_sub
  const ship = H.postage + H.supplies
  const losses = -H.refunds - H.claim
  const seg = (label, amt, color, fg, note) => ({
    label,
    amt: usd(amt),
    w: Math.round((amt / moneyIn) * 1000) / 10,
    pct: Math.round((amt / moneyIn) * 100) + '%',
    color,
    fg,
    note,
  })
  const flow = [
    seg('You kept', kept, '#1B5E43', '#F4EFDF', 'Yours — before what you originally paid for the cards.'),
    seg(
      'eBay fees',
      fees,
      '#B4531F',
      '#F4EFDF',
      usd(H.fvf_var + H.fvf_fixed) + ' selling fees · ' + usd(H.promo_offsite + H.promo_general) + ' ads · ' + usd(H.insertion + H.gallery) + ' listing fees · ' + usd(H.store_sub) + ' store'
    ),
    seg('Shipping & supplies', ship, '#8A8272', '#F4EFDF', 'Buyers reimbursed ' + usd(H.ship_charged) + ' of it, so shipping roughly broke even.'),
    seg('Refunds & a lost card', losses, '#5C2E14', '#EDD9C8', usd(-H.claim) + ' was a single card lost in the mail in March.'),
  ]

  // Ch3 — monthly bars
  const maxSales = Math.max(...M.map((m) => m.item_sales))
  const monthBars = M.map((m) => {
    const big = m.item_sales === maxSales
    return {
      label: m.month,
      valFmt: usd(m.item_sales),
      h: Math.max(4, Math.round((m.item_sales / maxSales) * 100)),
      color: big ? '#1B5E43' : '#A9BCA9',
      valColor: big ? '#164A35' : '#8A8272',
      lblColor: big ? '#221F1A' : '#8A8272',
    }
  })
  const janShare = Math.round((maxSales / H.item_sales) * 100) + '%'

  // Ch4 — top 3
  const top3 = D.top.slice(0, 3).map((t, i) => ({
    rank: i + 1,
    title: t.title,
    sport: t.sport,
    sale: usd2(t.item_sales),
    kept: usd2(t.net_after_supplies),
  }))
  const t3 = D.top.slice(0, 3).reduce((a, t) => a + t.net_after_supplies, 0)
  const bb = D.sport['Baseball']

  // Ch5 — fee load
  const fixedMo = (H.insertion + H.gallery + H.store_sub + H.promo_offsite + H.promo_general) / 6
  const maxLoad = Math.max(...M.map((m) => m.fee_load))
  const loadRows = M.map((m) => {
    const worst = m.fee_load === maxLoad
    return {
      label: m.month,
      pct: Math.round(m.fee_load) + '%',
      w: Math.min(100, Math.round(m.fee_load)),
      color: worst ? '#B4531F' : '#D3A184',
      fg: worst ? '#B4531F' : '#6B6459',
    }
  })

  // Ch6 — funnel
  const st = D.funnel.primary.stages
  const funnelStats = st
    .filter((s) => s.top10 != null)
    .map((s) => ({
      label: s.label === 'Click-through rate' ? 'Shoppers who click your listing' : 'Clicks that become a sale',
      you: s.you + '%',
      top: s.top10 + '%',
    }))

  // Moves
  const ga = D.shippingAnalysis.byService.find((s) => /Ground/.test(s.service))
  const gaLoss = ga ? usd(ga.totPostage - ga.totCharged) : '$45'
  const moves = [
    {
      n: 1,
      title: 'Stop losing on big-card postage',
      body:
        'Every USPS Ground Advantage label cost you about $' +
        (ga ? (-ga.avgMargin).toFixed(2) : '1.16') +
        ' more than buyers paid — ' +
        gaLoss +
        ' total in H1. Raise the shipping price on heavier cards or fold it into the item price. Standard Envelope is fine as-is.',
    },
    {
      n: 2,
      title: 'Trim the fixed drag',
      body:
        'Listing fees (' +
        usd(H.insertion + H.gallery) +
        ') and offsite ads (' +
        usd(H.promo_offsite) +
        ') run whether you sell or not. Relist within free allowances and check whether offsite ads are actually producing sales before renewing.',
    },
    {
      n: 3,
      title: 'Get seen',
      body:
        "eBay's own recommendations: add free shipping to your cheap listings and consider an 8% promoted rate. Your click-through rate is 7× below top sellers — visibility, not reputation, is the bottleneck.",
    },
  ]

  const janLoad = Math.round(M[0].fee_load)
  const junLoad = Math.round(M[5].fee_load)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px 90px' }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '22px 0 16px', borderBottom: '1px solid #D3C9B6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1B5E43', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4EFDF', fontWeight: 800, fontSize: 17, letterSpacing: '-.5px' }}>CC</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.4px', lineHeight: 1.1 }}>{meta.seller}</div>
            <div style={{ fontSize: 12.5, color: '#6B6459', marginTop: 2 }}>
              How the first half of 2026 went · <span className="tnum">{meta.period}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 9, padding: '7px 11px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1B5E43' }} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: '#8A8272', fontWeight: 700 }}>Data through</div>
            <div className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>Jun 30, 2026</div>
          </div>
        </div>
      </div>

      {/* CH 1 · BOTTOM LINE */}
      <section style={{ marginTop: 30 }}>
        <div className="lift" style={{ background: '#164A35', border: '1px solid #123C2B', borderRadius: 18, padding: '30px 32px', color: '#F4EFDF' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#AEC3B6' }}>The bottom line</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap', marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#C4D6CB' }}>You kept</div>
              <div className="tnum" style={{ fontSize: 58, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1, marginTop: 6 }}>{usd(kept)}</div>
            </div>
            <div style={{ maxWidth: 400, fontSize: 15, lineHeight: 1.55, color: '#DCE7DF', paddingBottom: 4 }}>
              of <b className="tnum" style={{ color: '#fff' }}>{usd(H.item_sales)}</b> in card sales — <b style={{ color: '#fff' }}>{keptCents}¢ of every dollar</b> a buyer spent on cards, after every eBay fee, postage and supplies.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(244,239,223,.16)' }}>
            {heroStats.map((s) => (
              <div key={s.label}>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 700 }}>{s.val}</div>
                <div style={{ fontSize: 11.5, color: '#AEC3B6', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 11.5, color: '#AEC3B6', lineHeight: 1.5 }}>
            What you paid for the cards themselves isn't in eBay's reports — so this is what you cleared, not final profit.
          </div>
        </div>
      </section>

      {/* CH 2 · WHERE THE MONEY WENT */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={1} title="Where every dollar went" size="sm" />
        <p style={{ fontSize: 14, color: '#524B3F', lineHeight: 1.6, maxWidth: 640, margin: '10px 0 18px' }}>
          Buyers paid <b className="tnum">{usd(moneyIn)}</b> in total — cards plus shipping they were charged. Here's how it split:
        </p>

        <div style={{ display: 'flex', height: 58, borderRadius: 12, overflow: 'hidden', border: '1px solid #D3C9B6' }}>
          {flow.map((f) => (
            <div key={f.label} style={{ width: f.w + '%', background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: f.fg, whiteSpace: 'nowrap', overflow: 'hidden' }}>{f.pct}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 14 }}>
          {flow.map((f) => (
            <div key={f.label} style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, flex: 'none' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{f.label}</span>
              </div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.5px', marginTop: 8 }}>{f.amt}</div>
              <div style={{ fontSize: 11.5, color: '#6B6459', lineHeight: 1.5, marginTop: 6 }}>{f.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CH 3 · JANUARY CARRIED IT */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={2} title="January carried the half" size="sm" />
        <p style={{ fontSize: 14, color: '#524B3F', lineHeight: 1.6, maxWidth: 640, margin: '10px 0 18px' }}>
          <b className="tnum">{janShare}</b> of everything you sold happened in January. Every month since has been a fraction of it — this is a hit-driven business, and January had the hits.
        </p>

        <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 14, padding: '20px 22px 14px' }}>
          <div style={{ position: 'relative', height: 190 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '3.5%', paddingBottom: 24 }}>
              {monthBars.map((b) => (
                <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div className="tnum" style={{ fontSize: 11.5, fontWeight: 700, color: b.valColor, marginBottom: 5 }}>{b.valFmt}</div>
                  <div style={{ width: '70%', maxWidth: 64, height: b.h + '%', background: b.color, borderRadius: '6px 6px 0 0' }} />
                  <div className="tnum" style={{ position: 'absolute', bottom: 0, fontSize: 12, fontWeight: 600, color: b.lblColor }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, background: '#F1EBDD', border: '1px solid #E0D8C7', borderRadius: 11, padding: '12px 15px', maxWidth: 640 }}>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>→</span>
          <p style={{ margin: 0, fontSize: 13, color: '#524B3F', lineHeight: 1.55 }}>
            One more thing hit this chart: a card <b>lost in the mail in March</b> cost you <b className="tnum">{usd(-H.claim)}</b> — it erased most of that month.
          </p>
        </div>
      </section>

      {/* CH 4 · THREE CARDS */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={3} title="Three cards made half your money" size="sm" />
        <p style={{ fontSize: 14, color: '#524B3F', lineHeight: 1.6, maxWidth: 640, margin: '10px 0 18px' }}>
          Out of {H.cards_net} cards sold, these three alone brought in <b className="tnum">{usd(t3)}</b> — <b>{Math.round((t3 / kept) * 100) + '%'} of everything you kept</b>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {top3.map((t) => (
            <div key={t.rank} className="lift" style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '14px 18px' }}>
              <span className="tnum" style={{ width: 26, height: 26, borderRadius: 8, background: '#221F1A', color: '#F4EFDF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flex: 'none' }}>{t.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{t.title}</div>
                <div style={{ fontSize: 11.5, color: '#8A8272', marginTop: 3 }}>
                  {t.sport} · sold for <span className="tnum">{t.sale}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 700, color: '#1B5E43' }}>{t.kept}</div>
                <div style={{ fontSize: 10.5, color: '#8A8272' }}>kept</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: '#6B6459', lineHeight: 1.6, maxWidth: 640, margin: '14px 0 0' }}>
          Baseball was your best sport overall — <b className="tnum">{usd(bb.net_after_supplies)}</b> kept across {bb.cards} cards, more than football and basketball combined.
        </p>
      </section>

      {/* CH 5 · SMALL MONTHS GET EATEN */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={4} title="Small months get eaten by fixed costs" accent="#B4531F" size="sm" />
        <p style={{ fontSize: 14, color: '#524B3F', lineHeight: 1.6, maxWidth: 640, margin: '10px 0 18px' }}>
          Store subscription, listing fees and ads cost you roughly <b className="tnum">{usd(fixedMo)}/month</b> whether you sell or not. In a big month that's nothing; in a slow month it eats the profit. Costs took <b>{junLoad}¢ of every sales dollar in June</b>, vs <b>{janLoad}¢ in January</b>.
        </p>

        <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 14, padding: '20px 22px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6459', marginBottom: 10 }}>Share of each month's sales eaten by costs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {loadRows.map((r) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tnum" style={{ width: 32, fontSize: 12, fontWeight: 600, color: '#6B6459', flex: 'none' }}>{r.label}</span>
                <div style={{ flex: 1, height: 20, background: '#EDE6D5', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: r.w + '%', height: '100%', background: r.color, borderRadius: 6 }} />
                </div>
                <span className="tnum" style={{ width: 42, fontSize: 12.5, fontWeight: 700, color: r.fg, textAlign: 'right', flex: 'none' }}>{r.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CH 6 · VISIBILITY */}
      <section style={{ marginTop: 44 }}>
        <SectionHeader n={5} title="Buyers love you — they just can't find you" accent="#B4531F" size="sm" />
        <p style={{ fontSize: 14, color: '#524B3F', lineHeight: 1.6, maxWidth: 640, margin: '10px 0 18px' }}>
          Your store's reputation is spotless: <b>100% positive feedback</b>. The problem is upstream — shoppers rarely click your listings, and eBay's own quality report says the same thing.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {funnelStats.map((f) => (
            <div key={f.label} style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '16px 18px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{f.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
                <div>
                  <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color: '#B4531F' }}>{f.you}</div>
                  <div style={{ fontSize: 10.5, color: '#8A8272' }}>you</div>
                </div>
                <div style={{ fontSize: 15, color: '#C7BCA6' }}>vs</div>
                <div>
                  <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color: '#1B5E43' }}>{f.top}</div>
                  <div style={{ fontSize: 10.5, color: '#8A8272' }}>top sellers in your category</div>
                </div>
              </div>
            </div>
          ))}
          <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '16px 18px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Feedback score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color: '#1B5E43' }}>100%</div>
              <div style={{ fontSize: 11.5, color: '#8A8272' }}>positive — from your eBay store page</div>
            </div>
          </div>
        </div>
      </section>

      {/* MOVES */}
      <section style={{ marginTop: 44 }}>
        <div style={{ background: '#221F1A', borderRadius: 18, padding: '28px 30px', color: '#EDE7DB' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#A79F8F' }}>So what now · three moves for H2</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, marginTop: 18 }}>
            {moves.map((m) => (
              <div key={m.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="tnum" style={{ width: 24, height: 24, borderRadius: 7, background: '#1B5E43', color: '#F4EFDF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{m.n}</span>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{m.title}</div>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, color: '#C4BDAE' }}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18, fontSize: 11.5, color: '#8A8272' }}>
          <span>
            Built from your eBay transaction ledger, orders report &amp; listing-quality report · <span className="tnum">{meta.period}</span>
          </span>
          <Link to="/" style={{ color: '#524B3F', fontWeight: 600 }}>
            Open the full dashboard →
          </Link>
        </div>
      </section>
    </div>
  )
}
