// Normaliza a formato E.164. Devuelve null si no parece un número válido.
module.exports = Object.freeze({
  normalize(raw, defaultCountry) {
    let s = String(raw || "").trim()
    const plus = s.startsWith("+")
    let d = s.replace(/\D/g, "")
    if (!d) return null
    if (plus) {
      // ya trae código de país
    } else if (d.length === 10) {
      d = defaultCountry + d
    } else if (d.startsWith("00")) {
      d = d.slice(2)
    }
    // México: el antiguo prefijo móvil 521 se normaliza a 52.
    if (d.length === 13 && d.startsWith("521")) d = "52" + d.slice(3)
    if (d.length < 11 || d.length > 15) return null
    return "+" + d
  },
})
