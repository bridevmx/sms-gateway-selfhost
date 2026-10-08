#!/bin/sh
set -e

# Crea o actualiza el superusuario con las credenciales del entorno.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090
