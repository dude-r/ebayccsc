import { useEffect } from 'react'
import { usd2 } from '../lib/format.js'
import { acqCost, isModeling, modelLabel as modelLabelOf } from '../lib/costModel.js'

// eBay-style "Order details" breakdown for one card: mirrors eBay's own
// per-order earnings screen, then folds back the fees eBay's screen hides
// (offsite/promoted ad fee, packaging supplies, modeled card cost) down to
// the true net kept. Ported from the prototype's `detail` computation.
export default function CardDetailModal({ card: c, cm, onClose }) {
  const monthing = isModeling(cm)
  const modelLabel = modelLabelOf(cm)

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = c.postage == null ? 0 : c.postage
  const ship = c.ship || 0
  const fvf = c.fvf || 0
  const adFee = Math.max(0, +(c.fees - fvf - label).toFixed(2)) // promoted/offsite ads eBay bills separately
  const grossToYou = c.item_sales + ship
  const ebayEarnings = +(grossToYou - fvf - label).toFixed(2)
  const acqC = acqCost(c, cm)
  const trueNet = +(ebayEarnings - adFee - c.supplies - (monthing ? acqC : 0)).toFixed(2)

  const paid = [{ label: 'Item subtotal', val: usd2(c.item_sales) }]
  if (ship > 0) paid.push({ label: 'Shipping', val: usd2(ship) })
  paid.push({ label: 'Sales tax (eBay collects & remits)', val: 'pass-through' })

  const ebayCosts = [{ label: 'Transaction fee', val: '-' + usd2(fvf) }]
  if (label > 0) ebayCosts.push({ label: 'Shipping label', val: '-' + usd2(label) })

  const hidden = []
  if (adFee > 0) hidden.push({ label: 'Promoted / offsite ad fee', val: '-' + usd2(adFee) })
  hidden.push({ label: 'Packaging supplies', val: '-' + usd2(c.supplies) })

  const netColor = trueNet < 0 ? '#F0A78A' : '#fff'
  const netLabel = monthing ? 'True profit in your pocket' : 'Net kept after all costs'
  const netSub = monthing
    ? 'after ad fees, supplies & modeled card cost'
    : 'after ad fees & supplies (before card cost)'

  const rowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }
  const totalRow = { ...rowStyle, fontSize: 14, fontWeight: 800, paddingTop: 9, marginTop: 7, borderTop: '1px solid #E0D8C7' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,15,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto', zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: '#E9E3D6', borderRadius: 20, boxShadow: '0 30px 70px -20px rgba(20,18,15,.6)', overflow: 'hidden' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 22px 16px', borderBottom: '1px solid #D3C9B6' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: '#8A8272' }}>Order details</div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginTop: 5, maxWidth: 330 }}>{c.title}</div>
            <div style={{ fontSize: 11.5, color: '#6B6459', marginTop: 4 }}>
              <span className="tnum">{c.date}</span> · {c.channel} · <span className="tnum">order {c.order}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', border: '1px solid #D3C9B6', background: '#FBF9F4', color: '#524B3F', fontSize: 15, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {/* what buyer paid */}
          <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '15px 17px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 11 }}>What your buyer paid</div>
            {paid.map((r) => (
              <div key={r.label} style={{ ...rowStyle, color: '#524B3F' }}>
                <span>{r.label}</span>
                <span className="tnum">{r.val}</span>
              </div>
            ))}
            <div style={totalRow}>
              <span>Order total</span>
              <span className="tnum">{usd2(grossToYou)}</span>
            </div>
          </div>

          {/* eBay earnings waterfall */}
          <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 13, padding: '15px 17px', marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 11 }}>What eBay says you earned</div>
            <div style={{ ...rowStyle, color: '#524B3F' }}>
              <span>Money to you (item + shipping)</span>
              <span className="tnum">{usd2(grossToYou)}</span>
            </div>
            {ebayCosts.map((r) => (
              <div key={r.label} style={{ ...rowStyle, color: '#B4531F' }}>
                <span>{r.label}</span>
                <span className="tnum">{r.val}</span>
              </div>
            ))}
            <div style={totalRow}>
              <span>eBay "Order earnings"</span>
              <span className="tnum">{usd2(ebayEarnings)}</span>
            </div>
          </div>

          {/* what eBay leaves out */}
          <div style={{ background: '#FBF3E8', border: '1px solid #E4C9A6', borderRadius: 13, padding: '15px 17px', marginTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A4A1C', marginBottom: 10 }}>What that number leaves out</div>
            {hidden.map((r) => (
              <div key={r.label} style={{ ...rowStyle, color: '#8A4A1C' }}>
                <span>{r.label}</span>
                <span className="tnum">{r.val}</span>
              </div>
            ))}
            {monthing && (
              <div style={{ ...rowStyle, color: '#8A4A1C' }}>
                <span>Card cost ({modelLabel.toLowerCase()})</span>
                <span className="tnum">{'-' + usd2(acqC)}</span>
              </div>
            )}
          </div>

          {/* true net */}
          <div style={{ background: '#164A35', borderRadius: 13, padding: '16px 18px', marginTop: 12, color: '#F4EFDF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: '#AEC3B6' }}>{netLabel}</div>
                <div style={{ fontSize: 11, color: '#AEC3B6', marginTop: 3 }}>{netSub}</div>
              </div>
              <div className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px', color: netColor }}>{usd2(trueNet)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8A8272', lineHeight: 1.5, marginTop: 11 }}>
            eBay's per-order screen excludes offsite/promoted ad fees (billed separately) and your packaging supplies — this
            view folds both back in so the number is what actually landed in your pocket.
          </div>
        </div>
      </div>
    </div>
  )
}
