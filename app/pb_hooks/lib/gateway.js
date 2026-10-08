// Cliente mínimo del API del gateway (/api/3rdparty/v1) con autenticación básica.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function b64(str) {
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 128) bytes.push(c)
    else if (c < 2048) bytes.push(192 | (c >> 6), 128 | (c & 63))
    else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63))
  }
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)]
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c || 0) >> 6)]
    out += c === undefined ? "=" : B64[c & 63]
  }
  return out
}

function call(method, path, body) {
  const cfg = require(`${__hooks}/lib/config.js`).get()
  const req = {
    url: cfg.gatewayUrl + path,
    method: method,
    headers: {
      Authorization: "Basic " + b64(cfg.gatewayUser + ":" + cfg.gatewayPass),
      "Content-Type": "application/json",
    },
    timeout: 20,
  }
  if (body) req.body = JSON.stringify(body)
  try {
    const res = $http.send(req)
    let json = null
    try {
      json = JSON.parse(toString(res.body))
    } catch (_) {}
    return { status: res.statusCode, json: json }
  } catch (err) {
    return { status: 0, json: null, error: String(err) }
  }
}

module.exports = Object.freeze({
  // m: { id, phone, text, at (ms) }
  enqueue(m) {
    return call("POST", "/messages", {
      id: m.id,
      phoneNumbers: [m.phone],
      textMessage: { text: m.text },
      scheduleAt: new Date(m.at).toISOString(),
      withDeliveryReport: true,
      ttl: 7200,
    })
  },
  status(gatewayId) {
    return call("GET", "/messages/" + gatewayId)
  },
  // Solo funciona mientras el mensaje está Pending en el gateway.
  cancel(gatewayId) {
    return call("DELETE", "/messages/" + gatewayId)
  },
  devices() {
    return call("GET", "/devices")
  },
  registerWebhook(url) {
    return call("POST", "/webhooks", { id: "campaigns-optout", url: url, event: "sms:received" })
  },
})
