#!/bin/sh
set -e

# Quita comillas, espacios y saltos de línea que a veces se cuelan al pegar el valor.
EMAIL=$(printf '%s' "$PB_ADMIN_EMAIL" | tr -d '"\047\r\n' | sed 's/^ *//;s/ *$//')
PASS=$(printf '%s' "$PB_ADMIN_PASSWORD" | tr -d '\r\n')

mkdir -p /pb/pb_data
MARK=/pb/pb_data/.admin_hash

if [ -z "$EMAIL" ] || [ -z "$PASS" ]; then
  echo "AVISO: PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD vacíos; no se crea superusuario." >&2
else
  # Solo se actualiza el superusuario si cambió el correo o la contraseña. Hacerlo en cada
  # arranque invalidaría las sesiones abiertas (upsert regenera la clave de los tokens).
  HASH=$(printf '%s:%s' "$EMAIL" "$PASS" | sha256sum | cut -d' ' -f1)
  if [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$HASH" ]; then
    echo "Superusuario sin cambios: $EMAIL"
  elif /pb/pocketbase superuser upsert "$EMAIL" "$PASS"; then
    printf '%s' "$HASH" > "$MARK"
    echo "Superusuario listo: $EMAIL"
  else
    # No se aborta: el servidor arranca y se puede corregir la variable sin bucle de reinicios.
    echo "AVISO: no se pudo crear el superusuario con PB_ADMIN_EMAIL='$EMAIL' (correo válido y contraseña de 8+ caracteres)." >&2
  fi
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090
