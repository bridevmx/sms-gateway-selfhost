# Plan de acción: gateway de SMS autohospedado en Coolify

Objetivo: usar una tablet Android con SIM como gateway de SMS, con el servidor
privado de [SMS Gateway for Android](https://sms-gate.app) corriendo en una
instancia de Coolify, y envíos programáticos por API REST.

Documentación base:
- https://docs.sms-gate.app/getting-started/private-server/
- https://docs.sms-gate.app/features/private-server/

## Arquitectura

```
Tu script / app ──HTTPS──> Servidor privado (Coolify) <──HTTPS── App Android (tablet)
                               │      │
                               │      └─ MariaDB
                               └─ notificación push vía api.sms-gate.app → FCM → tablet
```

El servidor y los datos de los mensajes quedan en tu infraestructura. Solo la
notificación de "despertar" pasa por el servidor público `api.sms-gate.app`
(así no hay que configurar Firebase ni recompilar la app).

## Fase 0: Prerrequisitos

- [ ] Instancia de Coolify operativa, con un servidor que tenga Docker.
- [ ] Dominio o subdominio apuntando a Coolify (p. ej. `sms.tudominio.com`, registro A/CNAME).
- [ ] Cuenta de GitHub para el repositorio privado.
- [ ] Tablet Android 5.0 o superior con SIM/eSIM que envíe SMS desde la app de mensajes nativa.
- [ ] Computadora con `adb` instalado y "Depuración USB" activada en la tablet.

## Fase 1: Repositorio privado en GitHub

```bash
cd sms-gateway-selfhost
git init -b main
git add .
git commit -m "Servidor privado SMS Gateway para Coolify"
gh repo create sms-gateway-selfhost --private --source=. --push
```

Antes del commit confirma que no hay secretos: `.env` y `config.yml` están en `.gitignore`;
solo se suben `.env.example` y `config.example.yml` con valores de marcador.

## Fase 2: Despliegue en Coolify

1. **Conectar GitHub**: en Coolify, Sources → GitHub App (o Deploy Key para un repo privado).
2. **Nuevo recurso**: Projects → New Resource → repositorio privado → build pack **Docker Compose**
   → rama `main` → archivo `docker-compose.yml`.
3. **Variables de entorno** (genera cada secreto con `openssl rand -base64 32`):
   `GATEWAY_PRIVATE_TOKEN`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`
   (opcionales: `DB_NAME`, `DB_USER`, `SERVER_VERSION`, `QUEUE_MAX_PENDING`).
4. **Dominio**: asigna `https://sms.tudominio.com` al servicio `server`, puerto `3000`.
   No expongas `db` ni `worker`.
5. **Deploy** y revisa los logs de `server`: debe conectar a la base y levantar en el puerto 3000.
6. **Verificar**: `curl https://sms.tudominio.com/health` debe devolver JSON de estado.

## Fase 3: Tablet

1. Descarga el APK de https://github.com/capcom6/android-sms-gateway/releases
2. Ejecuta `./scripts/tablet-setup.sh ruta/al/app.apk` (instala, concede permisos SMS,
   excluye del ahorro de batería). Verifica el nombre del paquete con
   `adb shell pm list packages | grep -i sms`; el script usa uno por defecto sin verificar.
3. En la tablet, app → Settings → Cloud Server:
   - API URL: `https://sms.tudominio.com/api/mobile/v1` (la ruta `/api/mobile/v1` es obligatoria)
   - Private Token: el mismo `GATEWAY_PRIVATE_TOKEN`
4. Pestaña Home: activar "Cloud server" y tocar **Offline** hasta que pase a **Online**.
   Se generan solas un usuario y una contraseña: guárdalos (aparecen en Cloud Server).
5. Cambiar de servidor reinicia las credenciales y exige registrar el dispositivo de nuevo.

## Fase 4: Prueba de extremo a extremo

```bash
BASE_URL=https://sms.tudominio.com SMS_USER=XXXXXX SMS_PASS=xxxx \
  ./scripts/send-test.sh +52XXXXXXXXXX "Prueba del gateway"
```

Endpoint de envío en modo privado: `POST /api/3rdparty/v1/messages`, cuerpo
`{"phoneNumbers": ["+52..."], "textMessage": {"text": "..."}}`, autenticación básica
con el usuario y contraseña generados por la app.

## Fase 5: Endurecimiento y operación

- [ ] Tablet siempre conectada a corriente, sin ahorro de batería, con la app permitida en segundo plano.
- [ ] Limitar el envío: pausas entre mensajes y `QUEUE_MAX_PENDING` para no saturar la SIM; los operadores pueden bloquear líneas con patrón de spam.
- [ ] Respaldos periódicos del volumen `db_data` (Coolify permite programar backups de bases de datos).
- [ ] Fijar `SERVER_VERSION` a una versión concreta una vez que todo funcione y actualizar de forma deliberada.
- [ ] Rotar `GATEWAY_PRIVATE_TOKEN` si se filtra (obliga a re-registrar la tablet).
- [ ] Opcional: dashboard web (`ghcr.io/android-sms-gateway/web-dashboard`) y webhooks para SMS entrantes.

## Fase 6: Integración

- Cliente propio en Node o Python con cola de envíos, reintentos y consulta de estado.
- Existen librerías cliente: `android-sms-gateway` en npm, y cliente para Python y PHP del mismo autor.

## Verificado contra el código oficial

- Variables de entorno `GATEWAY__*`, `HTTP__*`, `DATABASE__*`: confirmadas en `config.example.yml` del servidor.
- Migraciones: el entrypoint de la imagen ejecuta `db:migrate up` al arrancar con el comando por defecto.
- El worker espera a que `server` esté sano (healthcheck propio de la imagen).

## Pendientes de verificar al primer despliegue

1. Revisar los logs de `server` (conexión a la base, migraciones aplicadas).
2. Nombre del paquete Android si usas `scripts/tablet-setup.sh` (opcional; la app se instala a mano).
3. Opcional: definir `HTTP__PROXIES` con la red Docker de Coolify si necesitas la IP real del cliente.
