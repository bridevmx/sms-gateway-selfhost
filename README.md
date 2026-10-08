# sms-gateway-selfhost

Servidor privado de [SMS Gateway for Android](https://sms-gate.app) listo para
desplegar en Coolify, con MariaDB y worker de mantenimiento.

- **Plan completo:** [PLAN.md](PLAN.md)
- **Despliegue:** `docker-compose.yml` (usa la imagen oficial, sin build) (recurso "Docker Compose" en Coolify)
- **Variables:** `.env.example` (los valores reales van en Coolify, nunca en Git)
- **Tablet:** `scripts/tablet-setup.sh`
- **Prueba de envío:** `scripts/send-test.sh`

## Inicio rápido

1. Sube este repo a GitHub como **privado**.
2. En Coolify crea un recurso Docker Compose apuntando al repo, define las variables de `.env.example` y asigna el dominio al servicio `server` (puerto 3000).
3. Verifica `https://TU-DOMINIO/health`.
4. Configura la app en la tablet con `https://TU-DOMINIO/api/mobile/v1` y el mismo token.
5. Envía un mensaje de prueba con `scripts/send-test.sh`.
