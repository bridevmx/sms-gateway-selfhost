// Estados de mensaje: etiqueta y color (clases de punto y de fondo suave).
export const STATE = {
  pending: { label: 'Programado', dot: 'bg-base-content/40', soft: 'bg-base-200 text-base-content/70' },
  queued: { label: 'En cola', dot: 'bg-info', soft: 'bg-info/10 text-info' },
  sent: { label: 'Enviado', dot: 'bg-primary', soft: 'bg-primary/10 text-primary' },
  delivered: { label: 'Entregado', dot: 'bg-success', soft: 'bg-success/10 text-success' },
  failed: { label: 'Fallido', dot: 'bg-error', soft: 'bg-error/10 text-error' },
  cancelled: { label: 'Cancelado', dot: 'bg-warning', soft: 'bg-warning/15 text-warning-content' },
}

export const CAMPAIGN = {
  draft: { label: 'Borrador', dot: 'bg-base-content/40', soft: 'bg-base-200 text-base-content/70' },
  running: { label: 'En curso', dot: 'bg-info', soft: 'bg-info/10 text-info' },
  paused: { label: 'En pausa', dot: 'bg-warning', soft: 'bg-warning/15 text-warning-content' },
  done: { label: 'Terminada', dot: 'bg-success', soft: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelada', dot: 'bg-error', soft: 'bg-error/10 text-error' },
}

export const SOURCE = { api: 'API', manual: 'Manual', campaign: 'Campaña' }

const parse = (s) => {
  if (!s) return null
  const d = new Date(String(s).replace(' ', 'T'))
  return isNaN(d) ? null : d
}

export function fmtDate(s) {
  const d = parse(s)
  return d ? d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export function fmtTime(s) {
  const d = parse(s)
  return d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
}

// "hace 5 min", "en 2 h", "ayer 14:30"
export function fmtRelative(s) {
  const d = parse(s)
  if (!d) return '—'
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const min = Math.round(abs / 60000)
  if (abs < 45000) return diff > 0 ? 'en unos segundos' : 'hace unos segundos'
  let txt
  if (min < 60) txt = `${min} min`
  else if (min < 60 * 24) txt = `${Math.round(min / 60)} h`
  else return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return diff > 0 ? `en ${txt}` : `hace ${txt}`
}

export function errMsg(err) {
  const data = err?.response?.data
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0]
    if (first?.message) return first.message
  }
  return err?.response?.message || err?.message || 'Error desconocido'
}

export function initials(name, fallback = '#') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return fallback
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

// Segmentos SMS: GSM-7 (160 / 153) o UCS-2 si hay caracteres fuera del alfabeto (70 / 67).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_EXT = '^{}\\[~]|€'

export function smsInfo(text) {
  let units = 0
  let ucs2 = false
  const offending = new Set()
  for (const ch of String(text)) {
    if (GSM_BASIC.includes(ch)) units += 1
    else if (GSM_EXT.includes(ch)) units += 2
    else {
      ucs2 = true
      offending.add(ch)
    }
  }
  const chars = [...String(text)].length
  if (ucs2) {
    const segments = chars === 0 ? 0 : chars <= 70 ? 1 : Math.ceil(chars / 67)
    return { chars, segments, ucs2, limit: segments > 1 ? 67 : 70, offending: [...offending] }
  }
  const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153)
  return { chars: units, segments, ucs2, limit: segments > 1 ? 153 : 160, offending: [] }
}

export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
