import { COST_MODELS, NO_BASIS } from '../lib/costModel.js'
import { usd2 } from '../lib/format.js'

// On-page replacement for the prototype's host-provided "Tweaks" panel.
// Lets the user choose how per-card acquisition cost is modeled; every
// "modeled profit" figure on the page reacts to this.
export default function CostModelControl({ cm, onChange }) {
  const showFlat = cm.model === 'Flat $/card'
  const showPct = cm.model === '% of sale price'

  return (
    <div
      style={{
        marginTop: 16,
        background: '#FBF9F4',
        border: '1px solid #E0D8C7',
        borderRadius: 13,
        padding: '15px 18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.6px',
              color: '#8A4A1C',
            }}
          >
            Cost model
          </span>
          <span style={{ fontSize: 12, color: '#8A8272' }}>how per-card cost is estimated</span>
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#EDE6D5', borderRadius: 9, padding: 3, flexWrap: 'wrap' }}>
          {COST_MODELS.map((m) => {
            const active = cm.model === m
            const label = m === NO_BASIS ? 'Net after fees' : m
            return (
              <button
                key={m}
                onClick={() => onChange({ ...cm, model: m })}
                aria-pressed={active}
                style={{
                  border: 'none',
                  padding: '7px 12px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  background: active ? '#1B5E43' : 'transparent',
                  color: active ? '#F4EFDF' : '#6B6459',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {(showFlat || showPct) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          <label
            style={{ fontSize: 12, fontWeight: 700, color: '#6B6459', minWidth: 120 }}
            htmlFor="cost-slider"
          >
            {showFlat ? 'Cost per card' : 'Percent of sale price'}
          </label>
          <input
            id="cost-slider"
            type="range"
            min={0}
            max={showFlat ? 50 : 80}
            step={showFlat ? 0.5 : 1}
            value={showFlat ? cm.flatPerCard : cm.pctOfSale}
            onChange={(e) =>
              onChange(
                showFlat
                  ? { ...cm, flatPerCard: +e.target.value }
                  : { ...cm, pctOfSale: +e.target.value }
              )
            }
            style={{ flex: 1, minWidth: 180, accentColor: '#1B5E43' }}
          />
          <span
            className="tnum"
            style={{ fontSize: 14, fontWeight: 700, color: '#B4531F', minWidth: 74, textAlign: 'right' }}
          >
            {showFlat ? usd2(cm.flatPerCard) : cm.pctOfSale + '%'}
          </span>
        </div>
      )}
    </div>
  )
}
