/// <reference path="../pb_data/types.d.ts" />

// Nuevo origen de mensajes: envíos hechos a mano desde la web.
migrate((app) => {
  const col = app.findCollectionByNameOrId("messages")
  col.fields.getByName("source").values = ["campaign", "api", "manual"]
  app.save(col)
}, (app) => {
  const col = app.findCollectionByNameOrId("messages")
  col.fields.getByName("source").values = ["campaign", "api"]
  app.save(col)
})
