/// <reference path="../pb_data/types.d.ts" />

// Todas las colecciones quedan SIN reglas de API (null = solo superusuario).
// El acceso externo se hace únicamente por las rutas /api/v1/* (clave de API).
migrate((app) => {
  const stamps = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ]

  const contacts = new Collection({
    type: "base",
    name: "contacts",
    fields: [
      { type: "text", name: "name", max: 120 },
      { type: "text", name: "phone", required: true, max: 20 },
      { type: "bool", name: "consent" },
      { type: "bool", name: "opted_out" },
      { type: "text", name: "notes", max: 300 },
      ...stamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_contacts_phone ON contacts (phone)"],
  })
  app.save(contacts)

  const variantFields = [1, 2, 3, 4, 5].map((n) => ({ type: "text", name: "v" + n, max: 640 }))

  const templates = new Collection({
    type: "base",
    name: "templates",
    fields: [
      { type: "text", name: "name", required: true, max: 120 },
      { type: "text", name: "slug", required: true, max: 60, pattern: "^[a-z0-9_-]+$" },
      ...variantFields,
      { type: "bool", name: "active" },
      ...stamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_templates_slug ON templates (slug)"],
  })
  app.save(templates)

  const campaigns = new Collection({
    type: "base",
    name: "campaigns",
    fields: [
      { type: "text", name: "name", required: true, max: 120 },
      ...variantFields,
      {
        type: "select",
        name: "status",
        maxSelect: 1,
        values: ["draft", "running", "paused", "done", "cancelled"],
      },
      { type: "date", name: "start_at" },
      { type: "number", name: "min_delay" },
      { type: "number", name: "max_delay" },
      { type: "number", name: "daily_limit" },
      { type: "number", name: "window_start" },
      { type: "number", name: "window_end" },
      { type: "bool", name: "optout_footer" },
      ...stamps,
    ],
  })
  app.save(campaigns)

  const messages = new Collection({
    type: "base",
    name: "messages",
    fields: [
      { type: "relation", name: "campaign", collectionId: campaigns.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "contact", collectionId: contacts.id, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "phone", required: true, max: 20 },
      { type: "text", name: "text", required: true, max: 1000 },
      { type: "number", name: "variant" },
      { type: "select", name: "source", maxSelect: 1, values: ["campaign", "api"] },
      {
        type: "select",
        name: "state",
        maxSelect: 1,
        values: ["pending", "queued", "sent", "delivered", "failed", "cancelled"],
      },
      { type: "date", name: "scheduled_at" },
      { type: "text", name: "gateway_id", max: 60 },
      { type: "number", name: "attempts" },
      { type: "text", name: "error", max: 300 },
      ...stamps,
    ],
    indexes: [
      "CREATE INDEX idx_messages_state_sched ON messages (state, scheduled_at)",
      "CREATE INDEX idx_messages_campaign ON messages (campaign)",
    ],
  })
  app.save(messages)
}, (app) => {
  for (const name of ["messages", "campaigns", "templates", "contacts"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
