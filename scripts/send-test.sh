#!/usr/bin/env bash
# Envía un SMS de prueba a través del servidor privado.
#
# Uso:
#   BASE_URL=https://sms.tudominio.com SMS_USER=XXXXXX SMS_PASS=xxxx \
#     ./scripts/send-test.sh +52XXXXXXXXXX "Hola desde el gateway"
#
# SMS_USER / SMS_PASS son las credenciales que la app muestra en
# Cloud Server tras conectarse por primera vez (se generan solas).
set -euo pipefail

TO="${1:?Uso: $0 +52XXXXXXXXXX \"mensaje\"}"
TEXT="${2:-Prueba del gateway}"
: "${BASE_URL:?Define BASE_URL}" "${SMS_USER:?Define SMS_USER}" "${SMS_PASS:?Define SMS_PASS}"

echo "==> Salud del servidor"
curl -fsS "$BASE_URL/health"; echo

echo "==> Enviando mensaje"
curl -fsS -X POST "$BASE_URL/api/3rdparty/v1/messages" \
  -u "$SMS_USER:$SMS_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumbers\": [\"$TO\"], \"textMessage\": {\"text\": \"$TEXT\"}}"
echo
