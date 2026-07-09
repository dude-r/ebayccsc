// Currency formatting helpers — ported verbatim from the prototype so every
// displayed figure matches the original penny-for-penny.

// Whole-dollar, e.g. $1,614
export function usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

// Two-decimal, sign-aware, e.g. -$4.35 / $22.83
export function usd2(n) {
  const s = n < 0 ? '-' : ''
  return (
    s +
    '$' +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

// Signed whole-dollar, e.g. -$17 / $20 (used for shipping P/L)
export function signed(n) {
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
}
