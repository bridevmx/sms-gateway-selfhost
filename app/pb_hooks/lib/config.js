// Configuración leída de variables de entorno. Se llama a get() dentro de cada handler
// (los handlers de PocketBase JSVM no comparten scope con el archivo).
module.exports = Object.freeze({
  get() {
    const int = (k, d) => {
      const v = parseInt($os.getenv(k) || "", 10)
      return isNaN(v) ? d : v
    }
    return Object.freeze({
      gatewayUrl: ($os.getenv("GATEWAY_URL") || "http://server:3000/api/3rdparty/v1").replace(/\/+$/, ""),
      gatewayUser: $os.getenv("GATEWAY_USER") || "",
      gatewayPass: $os.getenv("GATEWAY_PASS") || "",
      apiKey: $os.getenv("API_KEY") || "",
      webhookSecret: $os.getenv("WEBHOOK_SECRET") || "",
      publicUrl: ($os.getenv("PUBLIC_URL") || "").replace(/\/+$/, ""),
      // Zona horaria como desfase en minutos respecto a UTC (México: -360).
      tz: int("TZ_OFFSET_MIN", -360),
      defaultCountry: $os.getenv("DEFAULT_COUNTRY") || "52",
      // Topes duros: la interfaz no puede saltárselos.
      minDelayFloor: int("MIN_DELAY_FLOOR", 20),
      maxPerDay: int("MAX_PER_DAY", 150),
      maxCampaignSize: int("MAX_CAMPAIGN_SIZE", 500),
      lookaheadSec: int("LOOKAHEAD_SEC", 90),
      // Valores por defecto para envíos por API.
      apiMinDelay: int("API_MIN_DELAY", 20),
      apiMaxDelay: int("API_MAX_DELAY", 60),
      apiWindowStart: int("API_WINDOW_START", 8),
      apiWindowEnd: int("API_WINDOW_END", 22),
      apiMaxBatch: int("API_MAX_BATCH", 20),
    })
  },
})
