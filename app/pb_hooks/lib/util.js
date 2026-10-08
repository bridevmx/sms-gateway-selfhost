// Utilidades comunes de las rutas.
function plain(x) {
  if (x === undefined || x === null) return x
  return JSON.parse(JSON.stringify(x))
}

// Los valores del body llegan como tipos Go envueltos; se convierten a JS nativo.
function bodyOf(e) {
  const b = e.requestInfo().body
  return b ? plain(b) : {}
}

function find(app, collection, id) {
  try {
    return app.findRecordById(collection, id)
  } catch (_) {
    throw new NotFoundError("No existe " + collection + "/" + id)
  }
}

// Lista de registros como array JS (findRecordsByFilter devuelve un slice Go).
function list(app, collection, filter, sort, limit, params, offset) {
  const rows = app.findRecordsByFilter(collection, filter, sort, limit, offset || 0, params || {})
  const out = []
  for (let i = 0; i < rows.length; i++) out.push(rows[i])
  return out
}

function findOrNull(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {})
  } catch (_) {
    return null
  }
}

// Intenta sacar del gateway los mensajes aún no procesados. Devuelve cuántos se recuperaron.
function pullBack(app, queued) {
  const gw = require(`${__hooks}/lib/gateway.js`)
  let ok = 0
  for (let i = 0; i < queued.length; i++) {
    const m = queued[i]
    const r = gw.cancel(m.getString("gateway_id"))
    if (r.status === 200) {
      m.set("state", "pending")
      m.set("gateway_id", "")
      app.save(m)
      ok++
    }
  }
  return ok
}

// Valida la cabecera X-API-Key de la API pública y devuelve la configuración.
function requireApiKey(e) {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const key = e.request.header.get("X-API-Key") || ""
  if (!cfg.apiKey || !$security.equal(key, cfg.apiKey)) throw new UnauthorizedError("API key inválida")
  return cfg
}

module.exports = Object.freeze({ plain, bodyOf, find, list, findOrNull, pullBack, requireApiKey })
