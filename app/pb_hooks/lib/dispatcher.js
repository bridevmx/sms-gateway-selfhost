// Tarea periódica (cada minuto): entrega al gateway los mensajes que vencen pronto,
// sincroniza estados y cierra campañas terminadas.
const MAX_ENQUEUE_PER_RUN = 20
const MAX_SYNC_PER_RUN = 40
const MAX_ATTEMPTS = 10

function dispatch(app, cfg, gw, M) {
  const due = app.findRecordsByFilter(
    "messages",
    "state = 'pending' && scheduled_at <= {:until}",
    "scheduled_at",
    MAX_ENQUEUE_PER_RUN,
    0,
    { until: M.pbDate(Date.now() + cfg.lookaheadSec * 1000) },
  )
  const campaigns = {}
  for (let i = 0; i < due.length; i++) {
    const m = due[i]
    const cid = m.getString("campaign")
    if (cid) {
      if (!campaigns[cid]) campaigns[cid] = app.findRecordById("campaigns", cid)
      if (campaigns[cid].getString("status") !== "running") continue
    }
    const attempts = m.getInt("attempts") + 1
    const gid = m.id + "x" + attempts
    const at = Math.max(M.parseMs(m.getString("scheduled_at")), Date.now() + 3000)
    const r = gw.enqueue({ id: gid, phone: m.getString("phone"), text: m.getString("text"), at: at })

    m.set("attempts", attempts)
    if (r.status === 202 || r.status === 409) {
      m.set("state", "queued")
      m.set("gateway_id", gid)
      m.set("error", "")
    } else if (r.status === 0 || r.status === 503 || r.status === 401 || r.status >= 500) {
      // Gateway caído, tablet offline o cola llena: se reintenta en el siguiente ciclo.
      m.set("error", "gateway " + r.status + (r.error ? " " + r.error : ""))
      if (attempts >= MAX_ATTEMPTS) m.set("state", "failed")
    } else {
      m.set("state", "failed")
      m.set("error", "gateway " + r.status + " " + JSON.stringify(r.json || {}).slice(0, 200))
    }
    app.save(m)
  }
}

function sync(app, gw) {
  const open = app.findRecordsByFilter(
    "messages",
    "(state = 'queued' || state = 'sent') && gateway_id != ''",
    "scheduled_at",
    MAX_SYNC_PER_RUN,
    0,
  )
  for (let i = 0; i < open.length; i++) {
    const m = open[i]
    const r = gw.status(m.getString("gateway_id"))
    if (r.status !== 200 || !r.json) continue
    const st = r.json.state
    if (st === "Delivered") {
      m.set("state", "delivered")
    } else if (st === "Sent") {
      m.set("state", "sent")
    } else if (st === "Failed") {
      let err = ""
      try {
        err = (r.json.recipients[0].error || "").slice(0, 280)
      } catch (_) {}
      m.set("state", "failed")
      m.set("error", err || "Falló el envío en el dispositivo")
    } else {
      continue
    }
    app.save(m)
  }
}

function closeCampaigns(app) {
  const running = app.findRecordsByFilter("campaigns", "status = 'running'", "", 50, 0)
  for (let i = 0; i < running.length; i++) {
    const c = running[i]
    const left = app.countRecords(
      "messages",
      $dbx.exp("campaign = {:c} AND (state = 'pending' OR state = 'queued')", { c: c.id }),
    )
    if (left === 0) {
      c.set("status", "done")
      app.save(c)
    }
  }
}

module.exports = Object.freeze({
  run(app) {
    const cfg = require(`${__hooks}/lib/config.js`).get()
    const gw = require(`${__hooks}/lib/gateway.js`)
    const M = require(`${__hooks}/lib/messages.js`)
    if (!cfg.gatewayUser || !cfg.gatewayPass) return
    try {
      dispatch(app, cfg, gw, M)
      sync(app, gw)
      closeCampaigns(app)
    } catch (err) {
      console.log("[dispatcher] error: " + err)
    }
  },
})
