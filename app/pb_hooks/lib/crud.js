// Helpers de la API de contactos y plantillas.
const SLUG = /^[a-z0-9_-]{1,60}$/

function str(v, max) {
  return String(v === undefined || v === null ? "" : v).trim().slice(0, max)
}

function contactOut(r) {
  return {
    id: r.id,
    name: r.getString("name"),
    phone: r.getString("phone"),
    consent: r.getBool("consent"),
    optedOut: r.getBool("opted_out"),
    notes: r.getString("notes"),
    created: r.getString("created"),
  }
}

function templateOut(r) {
  const variants = []
  for (let n = 1; n <= 5; n++) {
    const v = String(r.getString("v" + n) || "").trim()
    if (v) variants.push(v)
  }
  return {
    slug: r.getString("slug"),
    name: r.getString("name"),
    active: r.getBool("active"),
    variants: variants,
  }
}

function assertSlug(slug) {
  if (!SLUG.test(slug)) throw new BadRequestError("slug inválido: usa a-z, 0-9, - y _ (máx. 60)")
}

// body.variants: arreglo de 1 a 5 textos no vacíos.
function variantsFrom(raw) {
  if (!Array.isArray(raw)) throw new BadRequestError("variants debe ser un arreglo de textos")
  const out = raw.map((v) => str(v, 640)).filter((v) => v)
  if (out.length < 1 || out.length > 5) throw new BadRequestError("Indica de 1 a 5 variantes no vacías")
  return out
}

function setVariants(rec, variants) {
  for (let n = 1; n <= 5; n++) rec.set("v" + n, variants[n - 1] || "")
}

function findTemplate(app, slug) {
  try {
    return app.findFirstRecordByFilter("templates", "slug = {:s}", { s: slug })
  } catch (_) {
    throw new NotFoundError("Plantilla no encontrada")
  }
}

module.exports = Object.freeze({ str, contactOut, templateOut, assertSlug, variantsFrom, setVariants, findTemplate })
