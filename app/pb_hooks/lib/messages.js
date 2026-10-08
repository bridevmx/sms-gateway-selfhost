// Lógica compartida: plantillas, variantes, reparto de horarios (delays) y reprogramación.
const DAY = 86400000

function rnd(a, b) {
  if (b <= a) return a
  return a + Math.floor(Math.random() * (b - a + 1))
}
const localMs = (t, tz) => t + tz * 60000
const dayOf = (t, tz) => Math.floor(localMs(t, tz) / DAY)
const hourOf = (t, tz) => Math.floor((((localMs(t, tz) % DAY) + DAY) % DAY) / 3600000)
const dayStart = (day, tz) => day * DAY - tz * 60000
const windowOpen = (day, tz, ws) => dayStart(day, tz) + ws * 3600000 + rnd(0, 120) * 1000

function parseMs(s) {
  s = String(s || "")
  if (!s) return 0
  const t = new Date(s.replace(" ", "T")).getTime()
  return isNaN(t) ? 0 : t
}

// Formato de fecha que usa PocketBase: 2026-10-08 19:00:00.000Z
function pbDate(ms) {
  return new Date(ms).toISOString().replace("T", " ")
}

function variantsOf(record) {
  const out = []
  for (let n = 1; n <= 5; n++) {
    const v = String(record.getString("v" + n) || "").trim()
    if (v) out.push(v)
  }
  return out
}

// Reemplaza {nombre}, {algo}. Si falta el valor deja vacío y limpia espacios dobles.
function render(tpl, vars) {
  return String(tpl)
    .replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

// Elige un índice de variante distinto al anterior cuando hay más de una.
function pickVariant(count, prev) {
  if (count <= 1) return 0
  let i = rnd(0, count - 1)
  if (i === prev) i = (i + 1 + rnd(0, count - 2)) % count
  return i
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || ""
}

// opts: { minDelay, maxDelay, dailyLimit, ws, we, tz } (delays en segundos, horas locales).
function normalizeOpts(o) {
  let ws = o.ws
  let we = o.we
  if (isNaN(ws) || isNaN(we) || ws < 0 || we > 24 || ws >= we) {
    ws = 0
    we = 24
  }
  const minDelay = Math.max(1, o.minDelay)
  return {
    minDelay: minDelay,
    maxDelay: Math.max(minDelay, o.maxDelay),
    dailyLimit: Math.max(1, o.dailyLimit),
    ws: ws,
    we: we,
    tz: o.tz,
  }
}

// Carga horarios ya ocupados y el uso diario de la línea (campañas + API comparten SIM).
function loadLoad(app, tz, excludeIds) {
  const now = Date.now()
  const skip = {}
  for (const id of excludeIds || []) skip[id] = true
  const rows = app.findRecordsByFilter(
    "messages",
    "scheduled_at >= {:from} && (state = 'pending' || state = 'queued' || state = 'sent' || state = 'delivered')",
    "",
    5000,
    0,
    { from: pbDate(now - 36 * 3600000) },
  )
  const occupied = []
  const usage = {}
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (skip[r.id]) continue
    const t = parseMs(r.getString("scheduled_at"))
    if (!t) continue
    const d = dayOf(t, tz)
    usage[d] = (usage[d] || 0) + 1
    if (t >= now - 300000) occupied.push(t)
  }
  return { occupied: occupied, usage: usage }
}

// Devuelve `count` instantes (ms) separados por delays aleatorios, dentro de la ventana
// horaria, respetando el tope diario y sin pisar horarios ya ocupados.
function allocate(app, count, startMs, rawOpts, excludeIds) {
  const o = normalizeOpts(rawOpts)
  const load = loadLoad(app, o.tz, excludeIds)
  const out = []
  let prev = null
  for (let i = 0; i < count; i++) {
    let t = prev === null ? startMs : prev + rnd(o.minDelay, o.maxDelay) * 1000
    for (let guard = 0; guard < 5000; guard++) {
      const day = dayOf(t, o.tz)
      const hour = hourOf(t, o.tz)
      if (hour < o.ws) {
        t = windowOpen(day, o.tz, o.ws)
        continue
      }
      if (hour >= o.we) {
        t = windowOpen(day + 1, o.tz, o.ws)
        continue
      }
      if ((load.usage[day] || 0) >= o.dailyLimit) {
        t = windowOpen(day + 1, o.tz, o.ws)
        continue
      }
      let clash = null
      for (const x of load.occupied) {
        if (Math.abs(x - t) < o.minDelay * 1000) {
          clash = x
          break
        }
      }
      if (clash !== null) {
        t = clash + rnd(o.minDelay, o.maxDelay) * 1000
        continue
      }
      break
    }
    const d = dayOf(t, o.tz)
    load.usage[d] = (load.usage[d] || 0) + 1
    load.occupied.push(t)
    out.push(t)
    prev = t
  }
  return out
}

function campaignOpts(camp, cfg) {
  const min = Math.max(cfg.minDelayFloor, camp.getInt("min_delay") || 60)
  const max = Math.max(min, camp.getInt("max_delay") || min + 30)
  const daily = Math.min(cfg.maxPerDay, camp.getInt("daily_limit") || cfg.maxPerDay)
  const ws = camp.getInt("window_start")
  const we = camp.getInt("window_end")
  return { minDelay: min, maxDelay: max, dailyLimit: daily, ws: ws, we: we || 24, tz: cfg.tz }
}

function apiOpts(cfg) {
  return {
    minDelay: Math.max(cfg.minDelayFloor, cfg.apiMinDelay),
    maxDelay: Math.max(cfg.apiMinDelay, cfg.apiMaxDelay),
    dailyLimit: cfg.maxPerDay,
    ws: cfg.apiWindowStart,
    we: cfg.apiWindowEnd,
    tz: cfg.tz,
  }
}

// Crea los mensajes pendientes con su horario. items: [{phone, contactId, text, variant}]
// Debe llamarse dentro de runInTransaction (app = txApp).
function createScheduled(app, items, startMs, opts, source, campaignId) {
  const times = allocate(app, items.length, startMs, opts, [])
  const col = app.findCollectionByNameOrId("messages")
  const ids = []
  for (let i = 0; i < items.length; i++) {
    const r = new Record(col)
    if (campaignId) r.set("campaign", campaignId)
    if (items[i].contactId) r.set("contact", items[i].contactId)
    r.set("phone", items[i].phone)
    r.set("text", items[i].text)
    r.set("variant", items[i].variant + 1)
    r.set("source", source)
    r.set("state", "pending")
    r.set("scheduled_at", pbDate(times[i]))
    r.set("attempts", 0)
    app.save(r)
    ids.push(r.id)
  }
  return { ids: ids, times: times }
}

// Reasigna horarios a mensajes pendientes existentes (reanudar, reintentar fallidos).
function reschedule(app, records, startMs, opts) {
  const times = allocate(
    app,
    records.length,
    startMs,
    opts,
    records.map((r) => r.id),
  )
  for (let i = 0; i < records.length; i++) {
    records[i].set("state", "pending")
    records[i].set("scheduled_at", pbDate(times[i]))
    app.save(records[i])
  }
  return times
}

module.exports = Object.freeze({
  rnd,
  parseMs,
  pbDate,
  variantsOf,
  render,
  pickVariant,
  firstName,
  allocate,
  campaignOpts,
  apiOpts,
  createScheduled,
  reschedule,
})
