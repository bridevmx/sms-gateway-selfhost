export const STATE_LABEL = {
  pending: 'Pendiente',
  queued: 'En cola',
  sent: 'Enviado',
  delivered: 'Entregado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
}
export const STATE_CLASS = {
  pending: 'badge-ghost',
  queued: 'badge-info',
  sent: 'badge-primary',
  delivered: 'badge-success',
  failed: 'badge-error',
  cancelled: 'badge-warning',
}
export const CAMPAIGN_LABEL = {
  draft: 'Borrador',
  running: 'En curso',
  paused: 'En pausa',
  done: 'Terminada',
  cancelled: 'Cancelada',
}
export const CAMPAIGN_CLASS = {
  draft: 'badge-ghost',
  running: 'badge-info',
  paused: 'badge-warning',
  done: 'badge-success',
  cancelled: 'badge-error',
}

export function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(String(s).replace(' ', 'T'))
  return isNaN(d) ? '—' : d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

export function errMsg(err) {
  return err?.response?.message || err?.message || 'Error desconocido'
}
