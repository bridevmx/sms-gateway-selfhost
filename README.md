# sms-gateway-selfhost

Servidor privado de [SMS Gateway for Android](https://sms-gate.app) listo para
desplegar en Coolify, con MariaDB y worker de mantenimiento.

- **Plan completo:** [PLAN.md](PLAN.md)
- **Despliegue:** `docker-compose.yml` (usa la imagen oficial, sin build) (recurso "Docker Compose" en Coolify)
- **Variables:** `.env.example` (los valores reales van en Coolify, nunca en Git)
- **Tablet:** `scripts/tablet-setup.sh`
- **Prueba de envío:** `scripts/send-test.sh`
- **Mensajes programados + API de envíos:** carpeta [app/](app/) (servicio `campaigns` del compose)

## Inicio rápido

1. Sube este repo a GitHub como **privado**.
2. En Coolify crea un recurso Docker Compose apuntando al repo, define las variables de `.env.example` y asigna el dominio al servicio `server` (puerto 3000).
3. Verifica `https://TU-DOMINIO/health`.
4. Configura la app en la tablet con `https://TU-DOMINIO/api/mobile/v1` y el mismo token.
5. Envía un mensaje de prueba con `scripts/send-test.sh`.

## Mensajes programados y API de envíos (`app/`)

Web (PocketBase + SvelteKit) con resumen, historial de mensajes (filtros, detalle, reintentar/cancelar,
exportar CSV), envío manual con vista previa y programación, contactos con consentimiento, plantillas y
campañas con pausas aleatorias, horario de envío, tope diario y hasta 5 variantes de mensaje. Incluye una API
(`X-API-Key`) para envíos simples o con plantilla, y para administrar contactos y plantillas (CRUD), que comparte la misma cola y límites.

1. Variables nuevas en Coolify: `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, `CAMPAIGNS_API_KEY`,
   `GATEWAY_API_USER` y `GATEWAY_API_PASS` (usuario y contraseña que muestra la app de la tablet).
2. Asigna otro dominio al servicio `campaigns`, puerto `8090`.
3. Entra con el correo y la contraseña del paso 1. La pestaña **API** muestra ejemplos `curl`.
4. Opcional, bajas por SMS ("BAJA"): define `CAMPAIGNS_PUBLIC_URL` y `CAMPAIGNS_WEBHOOK_SECRET` y pulsa
   "Registrar webhook" en la pestaña API.

Límites duros del servidor (variables): `MIN_DELAY_FLOOR` (20 s), `MAX_PER_DAY` (150), `TZ_OFFSET_MIN` (-360).
Pruebas locales: `pocketbase serve --hooksDir app/pb_hooks --migrationsDir app/pb_migrations --publicDir app/web/build`.
