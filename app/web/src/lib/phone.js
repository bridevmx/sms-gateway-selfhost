// Misma normalización que el servidor (pb_hooks/lib/phone.js).
export function normalizePhone(raw, country = '52') {
  const plus = String(raw || '').trim().startsWith('+')
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  if (!plus) {
    if (d.length === 10) d = country + d
    else if (d.startsWith('00')) d = d.slice(2)
  }
  if (d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3)
  if (d.length < 11 || d.length > 15) return null
  return '+' + d
}
