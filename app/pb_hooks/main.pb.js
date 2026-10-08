/// <reference path="../pb_data/types.d.ts" />

// Cada handler carga sus dependencias con require() DENTRO (scope aislado de goja).

// ---------------------------------------------------------------------------
// Tarea periódica: entrega al gateway, sincroniza estados, cierra campañas.
// ---------------------------------------------------------------------------
cronAdd("sms_dispatch", "* * * * *", () => {
  require(`${__hooks}/lib/dispatcher.js`).run($app)
})

// ---------------------------------------------------------------------------
// Administración (solo superusuario)
// ---------------------------------------------------------------------------

// Estado del gateway y límites activos.
routerAdd("GET", "/api/app/status", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const gw = require(`${__hooks}/lib/gateway.js`)
  let devices = []
  let gatewayOk = false
  let error = ""
  if (!cfg.gatewayUser || !cfg.gatewayPass) {
    error = "Faltan GATEWAY_USER / GATEWAY_PASS"
  } else {
    const r = gw.devices()
    gatewayOk = r.status === 200
    if (gatewayOk && Array.isArray(r.json)) {
      devices = r.json.map((d) => ({ id: d.id, name: d.name, lastSeen: d.lastSeen }))
    } else {
      error = "Gateway respondió " + r.status
    }
  }
  return e.json(200, {
    gatewayOk: gatewayOk,
    error: error,
    devices: devices,
    apiKeyConfigured: !!cfg.apiKey,
    limits: {
      minDelayFloor: cfg.minDelayFloor,
      maxPerDay: cfg.maxPerDay,
      maxCampaignSize: cfg.maxCampaignSize,
      tzOffsetMin: cfg.tz,
    },
  })
}, $apis.requireSuperuserAuth())

// Registra en el gateway el webhook de SMS entrantes (para las bajas: "BAJA").
routerAdd("POST", "/api/app/gateway/webhook", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const gw = require(`${__hooks}/lib/gateway.js`)
  if (!cfg.publicUrl || !cfg.webhookSecret) {
    throw new BadRequestError("Define PUBLIC_URL y WEBHOOK_SECRET en el servidor")
  }
  const url = cfg.publicUrl + "/api/app/webhook/sms?secret=" + cfg.webhookSecret
  const r = gw.registerWebhook(url)
  return e.json(200, { status: r.status, response: r.json })
}, $apis.requireSuperuserAuth())

// Inicia una campaña en borrador con los contactos elegidos.
routerAdd("POST", "/api/app/campaigns/{id}/start", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const M = require(`${__hooks}/lib/messages.js`)
  const P = require(`${__hooks}/lib/phone.js`)
  const U = require(`${__hooks}/lib/util.js`)

  if (!cfg.gatewayUser || !cfg.gatewayPass) {
    throw new BadRequestError("Faltan GATEWAY_USER / GATEWAY_PASS en el servidor")
  }
  const camp = U.find(e.app, "campaigns", e.request.pathValue("id"))
  if (camp.getString("status") !== "draft") throw new BadRequestError("La campaña no está en borrador")

  const variants = M.variantsOf(camp)
  if (variants.length === 0) throw new BadRequestError("Escribe al menos una variante de mensaje")

  const body = U.bodyOf(e)
  const wanted = Array.isArray(body.contactIds) ? body.contactIds : []
  const seen = {}
  const ids = wanted.filter((id) => typeof id === "string" && !seen[id] && (seen[id] = true))
  if (ids.length === 0) throw new BadRequestError("Selecciona al menos un contacto")
  if (ids.length > cfg.maxCampaignSize) {
    throw new BadRequestError("Máximo " + cfg.maxCampaignSize + " contactos por campaña")
  }

  const footer = camp.getBool("optout_footer") ? "\n\nResponde BAJA para no recibir mas mensajes." : ""
  const items = []
  const skipped = []
  let prev = -1
  for (let i = 0; i < ids.length; i++) {
    const c = U.findOrNull(e.app, "contacts", "id = {:id}", { id: ids[i] })
    if (!c) {
      skipped.push({ id: ids[i], reason: "no existe" })
      continue
    }
    if (!c.getBool("consent")) {
      skipped.push({ id: c.id, reason: "sin consentimiento" })
      continue
    }
    if (c.getBool("opted_out")) {
      skipped.push({ id: c.id, reason: "se dio de baja" })
      continue
    }
    const phone = P.normalize(c.getString("phone"), cfg.defaultCountry)
    if (!phone) {
      skipped.push({ id: c.id, reason: "teléfono inválido" })
      continue
    }
    const v = M.pickVariant(variants.length, prev)
    prev = v
    const text = M.render(variants[v], { nombre: M.firstName(c.getString("name")) }) + footer
    items.push({ phone: phone, contactId: c.id, text: text, variant: v })
  }
  if (items.length === 0) throw new BadRequestError("Ningún contacto es elegible para envío")

  const startAt = M.parseMs(camp.getString("start_at"))
  const start = Math.max(startAt, Date.now() + 10000)
  const opts = M.campaignOpts(camp, cfg)

  let times = []
  e.app.runInTransaction((txApp) => {
    times = M.createScheduled(txApp, items, start, opts, "campaign", camp.id).times
    camp.set("status", "running")
    txApp.save(camp)
  })

  return e.json(200, {
    created: items.length,
    skipped: skipped,
    firstAt: new Date(times[0]).toISOString(),
    lastAt: new Date(times[times.length - 1]).toISOString(),
  })
}, $apis.requireSuperuserAuth())

routerAdd("POST", "/api/app/campaigns/{id}/pause", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const camp = U.find(e.app, "campaigns", e.request.pathValue("id"))
  if (camp.getString("status") !== "running") throw new BadRequestError("La campaña no está en curso")
  const queued = U.list(e.app, "messages", "campaign = {:c} && state = 'queued'", "scheduled_at", 5000, { c: camp.id })
  const pulled = U.pullBack(e.app, queued)
  camp.set("status", "paused")
  e.app.save(camp)
  return e.json(200, { pulledBack: pulled, alreadyWithDevice: queued.length - pulled })
}, $apis.requireSuperuserAuth())

routerAdd("POST", "/api/app/campaigns/{id}/resume", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const M = require(`${__hooks}/lib/messages.js`)
  const U = require(`${__hooks}/lib/util.js`)
  const camp = U.find(e.app, "campaigns", e.request.pathValue("id"))
  if (camp.getString("status") !== "paused") throw new BadRequestError("La campaña no está en pausa")
  const pending = U.list(e.app, "messages", "campaign = {:c} && state = 'pending'", "scheduled_at", 5000, { c: camp.id })
  e.app.runInTransaction((txApp) => {
    if (pending.length) M.reschedule(txApp, pending, Date.now() + 10000, M.campaignOpts(camp, cfg))
    camp.set("status", "running")
    txApp.save(camp)
  })
  return e.json(200, { rescheduled: pending.length })
}, $apis.requireSuperuserAuth())

routerAdd("POST", "/api/app/campaigns/{id}/cancel", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const camp = U.find(e.app, "campaigns", e.request.pathValue("id"))
  const st = camp.getString("status")
  if (st !== "running" && st !== "paused") throw new BadRequestError("La campaña no se puede cancelar")
  const queued = U.list(e.app, "messages", "campaign = {:c} && state = 'queued'", "scheduled_at", 5000, { c: camp.id })
  U.pullBack(e.app, queued)
  const pending = U.list(e.app, "messages", "campaign = {:c} && state = 'pending'", "scheduled_at", 5000, { c: camp.id })
  e.app.runInTransaction((txApp) => {
    for (let i = 0; i < pending.length; i++) {
      pending[i].set("state", "cancelled")
      txApp.save(pending[i])
    }
    camp.set("status", "cancelled")
    txApp.save(camp)
  })
  return e.json(200, { cancelled: pending.length })
}, $apis.requireSuperuserAuth())

routerAdd("POST", "/api/app/campaigns/{id}/retry-failed", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const M = require(`${__hooks}/lib/messages.js`)
  const U = require(`${__hooks}/lib/util.js`)
  const camp = U.find(e.app, "campaigns", e.request.pathValue("id"))
  if (camp.getString("status") === "cancelled") throw new BadRequestError("La campaña está cancelada")
  const failed = U.list(e.app, "messages", "campaign = {:c} && state = 'failed'", "scheduled_at", 5000, { c: camp.id })
  if (failed.length === 0) return e.json(200, { retried: 0 })
  e.app.runInTransaction((txApp) => {
    for (let i = 0; i < failed.length; i++) {
      failed[i].set("attempts", 0)
      failed[i].set("error", "")
      failed[i].set("gateway_id", "")
    }
    M.reschedule(txApp, failed, Date.now() + 10000, M.campaignOpts(camp, cfg))
    if (camp.getString("status") === "done") {
      camp.set("status", "running")
      txApp.save(camp)
    }
  })
  return e.json(200, { retried: failed.length })
}, $apis.requireSuperuserAuth())

// ---------------------------------------------------------------------------
// Bajas: el gateway notifica los SMS recibidos. "BAJA" marca el contacto y cancela pendientes.
// ---------------------------------------------------------------------------
routerAdd("POST", "/api/app/webhook/sms", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const P = require(`${__hooks}/lib/phone.js`)
  const U = require(`${__hooks}/lib/util.js`)

  const secret = e.requestInfo().query.secret || ""
  if (!cfg.webhookSecret || !$security.equal(String(secret), cfg.webhookSecret)) {
    throw new UnauthorizedError("secreto inválido")
  }
  const body = U.bodyOf(e)
  if (body.event !== "sms:received" || !body.payload) return e.json(200, { ignored: true })

  const text = String(body.payload.message || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "")
  if (["BAJA", "STOP", "ALTO", "CANCELAR", "UNSUBSCRIBE"].indexOf(text) === -1) {
    return e.json(200, { ignored: true })
  }
  const phone = P.normalize(String(body.payload.phoneNumber || ""), cfg.defaultCountry)
  const contact = phone ? U.findOrNull(e.app, "contacts", "phone = {:p}", { p: phone }) : null
  if (!contact) return e.json(200, { ignored: true })

  const pending = U.list(e.app, "messages", "contact = {:c} && state = 'pending'", "", 5000, { c: contact.id })
  e.app.runInTransaction((txApp) => {
    contact.set("opted_out", true)
    txApp.save(contact)
    for (let i = 0; i < pending.length; i++) {
      pending[i].set("state", "cancelled")
      txApp.save(pending[i])
    }
  })
  return e.json(200, { optedOut: true, cancelled: pending.length })
})

// ---------------------------------------------------------------------------
// API pública de envíos (cabecera X-API-Key). Comparte cola, delays y topes
// con las campañas, así que nunca se envía más rápido que lo configurado.
// ---------------------------------------------------------------------------

// POST /api/v1/send
//  simple:     { "phone": "7731234567", "text": "Hola" }
//  plantilla:  { "phone": "7731234567", "template": "recordatorio", "vars": { "nombre": "Ana" } }
//  varios:     { "phones": ["...", "..."], ... }     (máx. API_MAX_BATCH)
//  opcional:   "sendAt": "2026-10-10T15:00:00Z"
routerAdd("POST", "/api/v1/send", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const M = require(`${__hooks}/lib/messages.js`)
  const P = require(`${__hooks}/lib/phone.js`)
  const U = require(`${__hooks}/lib/util.js`)

  const key = e.request.header.get("X-API-Key") || ""
  if (!cfg.apiKey || !$security.equal(key, cfg.apiKey)) throw new UnauthorizedError("API key inválida")
  if (!cfg.gatewayUser || !cfg.gatewayPass) throw new ApiError(503, "Gateway no configurado", {})

  const body = U.bodyOf(e)
  let rawPhones = []
  if (Array.isArray(body.phones)) rawPhones = body.phones
  else if (body.phone) rawPhones = [body.phone]
  if (rawPhones.length === 0) throw new BadRequestError("Indica phone o phones")
  if (rawPhones.length > cfg.apiMaxBatch) throw new BadRequestError("Máximo " + cfg.apiMaxBatch + " destinatarios por llamada")

  let variants = []
  const plainText = typeof body.text === "string" ? body.text.trim() : ""
  if (body.template) {
    const tpl = U.findOrNull(e.app, "templates", "slug = {:s} && active = true", { s: String(body.template) })
    if (!tpl) throw new NotFoundError("Plantilla no encontrada o inactiva")
    variants = M.variantsOf(tpl)
    if (variants.length === 0) throw new BadRequestError("La plantilla no tiene variantes")
  } else if (plainText) {
    variants = [plainText]
  } else {
    throw new BadRequestError("Indica text o template")
  }
  const vars = body.vars && typeof body.vars === "object" ? body.vars : {}

  let start = Date.now() + 5000
  if (body.sendAt) {
    const t = new Date(String(body.sendAt)).getTime()
    if (isNaN(t)) throw new BadRequestError("sendAt inválido (usa ISO 8601)")
    start = Math.max(start, t)
  }

  const items = []
  const skipped = []
  const dup = {}
  let prev = -1
  for (let i = 0; i < rawPhones.length; i++) {
    const phone = P.normalize(String(rawPhones[i]), cfg.defaultCountry)
    if (!phone) {
      skipped.push({ phone: String(rawPhones[i]), reason: "teléfono inválido" })
      continue
    }
    if (dup[phone]) continue
    dup[phone] = true
    const c = U.findOrNull(e.app, "contacts", "phone = {:p}", { p: phone })
    if (c && c.getBool("opted_out")) {
      skipped.push({ phone: phone, reason: "se dio de baja" })
      continue
    }
    const v = M.pickVariant(variants.length, prev)
    prev = v
    const merged = Object.assign({ nombre: c ? M.firstName(c.getString("name")) : "" }, vars)
    const text = M.render(variants[v], merged)
    if (!text) {
      skipped.push({ phone: phone, reason: "mensaje vacío" })
      continue
    }
    if (text.length > 640) {
      skipped.push({ phone: phone, reason: "mensaje demasiado largo (máx. 640)" })
      continue
    }
    items.push({ phone: phone, contactId: c ? c.id : "", text: text, variant: v })
  }
  if (items.length === 0) throw new BadRequestError("Ningún destinatario válido: " + JSON.stringify(skipped))

  let res = { ids: [], times: [] }
  e.app.runInTransaction((txApp) => {
    res = M.createScheduled(txApp, items, start, M.apiOpts(cfg), "api", "")
  })

  return e.json(202, {
    messages: res.ids.map((id, i) => ({
      id: id,
      phone: items[i].phone,
      scheduledAt: new Date(res.times[i]).toISOString(),
    })),
    skipped: skipped,
  })
})

// GET /api/v1/messages/{id}
routerAdd("GET", "/api/v1/messages/{id}", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const U = require(`${__hooks}/lib/util.js`)
  const key = e.request.header.get("X-API-Key") || ""
  if (!cfg.apiKey || !$security.equal(key, cfg.apiKey)) throw new UnauthorizedError("API key inválida")
  const m = U.find(e.app, "messages", e.request.pathValue("id"))
  return e.json(200, {
    id: m.id,
    phone: m.getString("phone"),
    state: m.getString("state"),
    scheduledAt: m.getString("scheduled_at"),
    error: m.getString("error"),
  })
})

// GET /api/v1/templates
routerAdd("GET", "/api/v1/templates", (e) => {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const M = require(`${__hooks}/lib/messages.js`)
  const U = require(`${__hooks}/lib/util.js`)
  const key = e.request.header.get("X-API-Key") || ""
  if (!cfg.apiKey || !$security.equal(key, cfg.apiKey)) throw new UnauthorizedError("API key inválida")
  const rows = U.list(e.app, "templates", "active = true", "name", 200)
  return e.json(
    200,
    rows.map((t) => ({ slug: t.getString("slug"), name: t.getString("name"), variants: M.variantsOf(t).length })),
  )
})
