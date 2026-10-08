#!/usr/bin/env bash
# Prepara la tablet por ADB: instala el APK, concede permisos de SMS y
# excluye la app del ahorro de batería.
#
# Uso:  ./scripts/tablet-setup.sh ruta/al/app.apk
# Requisitos: adb en el PATH, "Depuración USB" activada y tablet autorizada.
#
# El APK se descarga de la página de releases del proyecto:
#   https://github.com/capcom6/android-sms-gateway/releases
set -euo pipefail

APK="${1:?Uso: $0 ruta/al/app.apk}"
# Nombre de paquete por defecto: verifícalo con
#   adb shell pm list packages | grep -i sms
PKG="${PKG:-me.capcom.smsgateway}"

adb get-state >/dev/null || { echo "No hay tablet conectada/autorizada (adb devices)."; exit 1; }

echo "==> Instalando $APK"
adb install -r "$APK"

echo "==> Verificando paquete $PKG"
if ! adb shell pm list packages | tr -d '\r' | grep -qx "package:$PKG"; then
  echo "El paquete $PKG no está instalado. Revisa el nombre real:"
  adb shell pm list packages | grep -i sms || true
  exit 1
fi

echo "==> Concediendo permisos de SMS y estado del teléfono"
for perm in android.permission.SEND_SMS android.permission.READ_PHONE_STATE android.permission.POST_NOTIFICATIONS; do
  adb shell pm grant "$PKG" "$perm" 2>/dev/null || echo "   (no se pudo conceder $perm; concédelo a mano)"
done

echo "==> Excluyendo del ahorro de batería"
adb shell dumpsys deviceidle whitelist +"$PKG" || true

cat <<EOF

Listo. Pasos manuales que quedan en la tablet:
  1. Abrir la app y aceptar los permisos que falten.
  2. Android 13+: si SMS aparece bloqueado, Ajustes > Apps > (la app) >
     menú ⋮ > "Permitir ajustes restringidos", y volver a conceder SMS.
  3. Ajustes de la app > Cloud Server:
       API URL       : https://TU-DOMINIO/api/mobile/v1
       Private Token : el mismo GATEWAY_PRIVATE_TOKEN del servidor
  4. Pestaña Home: activar "Cloud server" y tocar "Offline" hasta que diga "Online".
EOF
