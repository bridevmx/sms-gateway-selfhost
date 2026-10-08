/// <reference path="../pb_data/types.d.ts" />

// API pública (X-API-Key) para administrar contactos y plantillas.
// Regla de seguridad: "optedOut" es de solo lectura; ningún sistema puede reactivar a quien pidió BAJA.

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

// GET /api/v1/contacts?q=ana&page=1&perPage=50
routerAdd("GET", "/api/v1/contacts", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)

  const query = e.requestInfo().query
  const q = String(query.q || "").trim()
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1)
  const perPage = Math.min(200, Math.max(1, parseInt(query.perPage || "50", 10) || 50))

  let rows, total
  if (q) {
    rows = U.list(e.app, "contacts", "name ~ {:q} || phone ~ {:q}", "name", perPage, { q: q }, (page - 1) * perPage)
    total = e.app.countRecords("contacts", $dbx.or($dbx.like("name", q), $dbx.like("phone", q)))
  } else {
    rows = U.list(e.app, "contacts", "id != ''", "name", perPage, {}, (page - 1) * perPage)
    total = e.app.countRecords("contacts")
  }
  return e.json(200, { items: rows.map(C.contactOut), page: page, perPage: perPage, total: total })
})

routerAdd("GET", "/api/v1/contacts/{id}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)
  return e.json(200, C.contactOut(U.find(e.app, "contacts", e.request.pathValue("id"))))
})

// POST /api/v1/contacts { "name": "Ana", "phone": "7731234567", "consent": true, "notes": "" }
routerAdd("POST", "/api/v1/contacts", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  const P = require(`${__hooks}/lib/phone.js`)
  const cfg = U.requireApiKey(e)

  const body = U.bodyOf(e)
  const phone = P.normalize(String(body.phone || ""), cfg.defaultCountry)
  if (!phone) throw new BadRequestError("Teléfono inválido")
  const dup = U.findOrNull(e.app, "contacts", "phone = {:p}", { p: phone })
  if (dup) throw new ApiError(409, "Ya existe un contacto con ese teléfono (id " + dup.id + ")", {})

  const rec = new Record(e.app.findCollectionByNameOrId("contacts"))
  rec.set("phone", phone)
  rec.set("name", C.str(body.name, 120))
  rec.set("notes", C.str(body.notes, 300))
  rec.set("consent", body.consent === true)
  rec.set("opted_out", false)
  e.app.save(rec)
  return e.json(201, C.contactOut(rec))
})

// PATCH /api/v1/contacts/{id}   (name, phone, consent, notes; optedOut NO se puede cambiar)
routerAdd("PATCH", "/api/v1/contacts/{id}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  const P = require(`${__hooks}/lib/phone.js`)
  const cfg = U.requireApiKey(e)

  const rec = U.find(e.app, "contacts", e.request.pathValue("id"))
  const body = U.bodyOf(e)

  if (body.phone !== undefined) {
    const phone = P.normalize(String(body.phone || ""), cfg.defaultCountry)
    if (!phone) throw new BadRequestError("Teléfono inválido")
    const dup = U.findOrNull(e.app, "contacts", "phone = {:p} && id != {:id}", { p: phone, id: rec.id })
    if (dup) throw new ApiError(409, "Ya existe un contacto con ese teléfono (id " + dup.id + ")", {})
    rec.set("phone", phone)
  }
  if (body.name !== undefined) rec.set("name", C.str(body.name, 120))
  if (body.notes !== undefined) rec.set("notes", C.str(body.notes, 300))
  if (body.consent !== undefined) rec.set("consent", body.consent === true)
  e.app.save(rec)
  return e.json(200, C.contactOut(rec))
})

routerAdd("DELETE", "/api/v1/contacts/{id}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  U.requireApiKey(e)
  e.app.delete(U.find(e.app, "contacts", e.request.pathValue("id")))
  return e.noContent(204)
})

// ---------------------------------------------------------------------------
// Plantillas (identificadas por su slug)
// ---------------------------------------------------------------------------

// GET /api/v1/templates   (activas) — con ?all=1 incluye las inactivas
routerAdd("GET", "/api/v1/templates", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)
  const all = e.requestInfo().query.all === "1"
  const rows = U.list(e.app, "templates", all ? "id != ''" : "active = true", "name", 200)
  return e.json(200, rows.map(C.templateOut))
})

routerAdd("GET", "/api/v1/templates/{slug}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)
  return e.json(200, C.templateOut(C.findTemplate(e.app, e.request.pathValue("slug"))))
})

// POST /api/v1/templates { "name": "Recordatorio", "slug": "recordatorio", "variants": ["...", "..."], "active": true }
routerAdd("POST", "/api/v1/templates", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)

  const body = U.bodyOf(e)
  const slug = String(body.slug || "").trim().toLowerCase()
  C.assertSlug(slug)
  if (U.findOrNull(e.app, "templates", "slug = {:s}", { s: slug })) {
    throw new ApiError(409, "Ya existe una plantilla con ese slug", {})
  }
  const name = C.str(body.name, 120)
  if (!name) throw new BadRequestError("name es obligatorio")

  const rec = new Record(e.app.findCollectionByNameOrId("templates"))
  rec.set("name", name)
  rec.set("slug", slug)
  rec.set("active", body.active !== false)
  C.setVariants(rec, C.variantsFrom(body.variants))
  e.app.save(rec)
  return e.json(201, C.templateOut(rec))
})

// PATCH /api/v1/templates/{slug}   (name, variants, active; el slug no cambia)
routerAdd("PATCH", "/api/v1/templates/{slug}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)

  const rec = C.findTemplate(e.app, e.request.pathValue("slug"))
  const body = U.bodyOf(e)
  if (body.name !== undefined) {
    const name = C.str(body.name, 120)
    if (!name) throw new BadRequestError("name no puede estar vacío")
    rec.set("name", name)
  }
  if (body.active !== undefined) rec.set("active", body.active === true)
  if (body.variants !== undefined) C.setVariants(rec, C.variantsFrom(body.variants))
  e.app.save(rec)
  return e.json(200, C.templateOut(rec))
})

routerAdd("DELETE", "/api/v1/templates/{slug}", (e) => {
  const U = require(`${__hooks}/lib/util.js`)
  const C = require(`${__hooks}/lib/crud.js`)
  U.requireApiKey(e)
  e.app.delete(C.findTemplate(e.app, e.request.pathValue("slug")))
  return e.noContent(204)
})
