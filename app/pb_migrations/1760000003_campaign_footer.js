/// <reference path="../pb_data/types.d.ts" />

// Texto del pie de baja editable por campaña (vacío = "Responde BAJA para salir").
migrate((app) => {
  const col = app.findCollectionByNameOrId("campaigns")
  col.fields.add(new TextField({ name: "footer_text", max: 80 }))
  app.save(col)
}, (app) => {
  const col = app.findCollectionByNameOrId("campaigns")
  col.fields.removeByName("footer_text")
  app.save(col)
})
