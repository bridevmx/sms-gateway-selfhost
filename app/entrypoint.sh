#!/bin/sh
set -e

# Quita comillas, espacios y saltos de línea que a veces se cuelan al pegar el valor.
EMAIL=$(printf '%s' "$PB_ADMIN_EMAIL" | tr -d '"\047\r\n' | sed 's/^ *//;s/ *$//')
PASS=$(printf '%s' "$PB_ADMIN_PASSWORD" | tr -d '\r\n')

if [ -z "$EMAIL" ] || [ -z "$PASS" ]; then
  echo "AVISO: PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD vacíos; no se crea superusuario." >&2
elif /pb/pocketbase superuser upsert "$EMAIL" "$PASS"; then
  echo "Superusuario listo: $EMAIL"
else
  # No se aborta: el servidor arranca y se puede corregir la variable sin bucle de reinicios.
  echo "AVISO: no se pudo crear el superusuario con PB_ADMIN_EMAIL='$EMAIL' (correo válido y contraseña de 8+ caracteres)." >&2
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090
