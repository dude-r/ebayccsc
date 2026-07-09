// Acquisition-cost model. eBay's reports never record what you *paid* to
// acquire each card, so "profit" is modeled from an assumption the user picks.
// Ported from the prototype's `acq` / `bandCost` / `modeling` logic.

import { usd2 } from './format.js'

export const NO_BASIS = 'Net after fees (no cost basis)'

export const COST_MODELS = [
  NO_BASIS,
  'Flat $/card',
  '% of sale price',
  'By price band',
]

export const DEFAULT_COST_MODEL = {
  model: NO_BASIS,
  flatPerCard: 5,
  pctOfSale: 40,
}

// Blended cost estimate per price band (dollars).
function bandCost(band) {
  const map = { '<$5': 0.5, '$5–20': 3, '$20–50': 9, '$50–100': 22, '$100+': 55 }
  return map[band] != null ? map[band] : 5
}

// Modeled acquisition cost for one card under the chosen model.
export function acqCost(card, cm) {
  if (cm.model === 'Flat $/card') return cm.flatPerCard != null ? cm.flatPerCard : 5
  if (cm.model === '% of sale price')
    return card.item_sales * ((cm.pctOfSale != null ? cm.pctOfSale : 40) / 100)
  if (cm.model === 'By price band') return bandCost(card.band)
  return 0 // Net after fees — no cost basis
}

// Whether a real cost basis is being modeled (vs. hard net-after-fees only).
export function isModeling(cm) {
  return cm.model !== NO_BASIS
}

// Human-readable label for the current model.
export function modelLabel(cm) {
  if (cm.model === 'Flat $/card') return 'Flat ' + usd2(cm.flatPerCard != null ? cm.flatPerCard : 5) + '/card'
  if (cm.model === '% of sale price') return (cm.pctOfSale != null ? cm.pctOfSale : 40) + '% of sale price'
  if (cm.model === 'By price band') return 'Cost by price band'
  return 'Net after fees only — no cost basis'
}
