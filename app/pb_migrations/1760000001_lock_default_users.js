/// <reference path="../pb_data/types.d.ts" />

// PocketBase crea una colección "users" con registro público. Esta app solo usa el
// superusuario, así que se cierra el acceso (null = solo superusuario).
migrate((app) => {
  try {
    const users = app.findCollectionByNameOrId("users")
    users.listRule = null
    users.viewRule = null
    users.createRule = null
    users.updateRule = null
    users.deleteRule = null
    app.save(users)
  } catch (_) {
    // la colección no existe: nada que cerrar
  }
}, (app) => {})
