// Envío simple o con plantilla (compartido por la API pública y la pantalla "Nuevo mensaje").
// body: { phone | phones[], text | template, vars{}, sendAt }   source: "api" | "manual"
module.exports = Object.freeze({
  send(app, body, source, maxBatch) {
    const cfg = require(`${__hooks}/lib/config.js`).get()
    const M = require(`${__hooks}/lib/messages.js`)
    const P = require(`${__hooks}/lib/phone.js`)
    const U = require(`${__hooks}/lib/util.js`)

    if (!cfg.gatewayUser || !cfg.gatewayPass) throw new ApiError(503, "Gateway no configurado", {})

    let rawPhones = []
    if (Array.isArray(body.phones)) rawPhones = body.phones
    else if (body.phone) rawPhones = [body.phone]
    if (rawPhones.length === 0) throw new BadRequestError("Indica al menos un destinatario")
    if (rawPhones.length > maxBatch) throw new BadRequestError("Máximo " + maxBatch + " destinatarios por envío")

    let variants = []
    const plainText = typeof body.text === "string" ? body.text.trim() : ""
    if (body.template) {
      const tpl = U.findOrNull(app, "templates", "slug = {:s} && active = true", { s: String(body.template) })
      if (!tpl) throw new NotFoundError("Plantilla no encontrada o inactiva")
      variants = M.variantsOf(tpl)
      if (variants.length === 0) throw new BadRequestError("La plantilla no tiene variantes")
    } else if (plainText) {
      variants = [plainText]
    } else {
      throw new BadRequestError("Escribe un mensaje o elige una plantilla")
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
      const c = U.findOrNull(app, "contacts", "phone = {:p}", { p: phone })
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
    app.runInTransaction((txApp) => {
      res = M.createScheduled(txApp, items, start, M.apiOpts(cfg), source, "")
    })

    return {
      messages: res.ids.map((id, i) => ({
        id: id,
        phone: items[i].phone,
        scheduledAt: new Date(res.times[i]).toISOString(),
      })),
      skipped: skipped,
    }
  },
})
