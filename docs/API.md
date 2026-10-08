# API de envíos, contactos y plantillas

Guía para integrar tus sistemas con el servicio de mensajes. Todo lo que envíes por la API entra en
**la misma cola** que las campañas y la pantalla "Nuevo mensaje": respeta las pausas aleatorias entre
mensajes, el horario permitido y el tope diario, así que un SMS puede salir minutos (o al día siguiente)
después de la llamada. La respuesta siempre te dice a qué hora quedó programado.

- [Conceptos básicos](#conceptos-básicos)
- [Enviar mensajes](#enviar-mensajes) · [Consultar estado](#consultar-el-estado-de-un-mensaje)
- [Contactos](#contactos) · [Plantillas](#plantillas)
- [Recetas](#recetas) · [Errores](#errores) · [Límites y configuración](#límites-y-configuración)
- [Lo que la API no hace](#lo-que-la-api-no-hace)

---

## Conceptos básicos

**URL base:** el dominio que asignaste al servicio `campaigns` (por ejemplo `https://envios.tudominio.com`).
En los ejemplos se usa `$BASE` y `$KEY`:

```bash
export BASE=https://envios.tudominio.com
export KEY=tu_api_key          # valor de CAMPAIGNS_API_KEY en Coolify
```

**Autenticación:** cabecera `X-API-Key` en todas las peticiones. Sin ella (o con una incorrecta) la
respuesta es `401`. La clave da acceso total a la API: úsala **solo desde tu servidor**, nunca en una
app web o móvil. Para rotarla, cambia `CAMPAIGNS_API_KEY` en Coolify y redespliega.

**Formato:** JSON en peticiones y respuestas (`Content-Type: application/json`).

**Teléfonos:** se normalizan a formato internacional (E.164). Acepta:

| Entrada | Resultado |
|---|---|
| `7731234567` (10 dígitos) | `+527731234567` |
| `+527731234567` | `+527731234567` |
| `+5217731234567` (antiguo prefijo móvil de México) | `+527731234567` |
| `+14155550123` (otro país, con `+`) | `+14155550123` |
| `123` | error: teléfono inválido |

**Estados de un mensaje:**

| Estado | Significado |
|---|---|
| `pending` | Programado; todavía no sale hacia la tablet. |
| `queued` | Entregado al gateway; la tablet lo enviará en segundos. |
| `sent` | La tablet lo envió a la red. |
| `delivered` | La operadora confirmó la entrega. |
| `failed` | Falló (el campo `error` explica por qué; p. ej. sin saldo en la SIM). |
| `cancelled` | Cancelado desde la web, o el contacto respondió BAJA antes de que saliera. |

---

## Enviar mensajes

### `POST /api/v1/send`

| Campo | Tipo | Descripción |
|---|---|---|
| `phone` | texto | Un destinatario. Usa `phone` **o** `phones`. |
| `phones` | arreglo | Varios destinatarios (máx. 20 por llamada; los repetidos se ignoran). |
| `text` | texto | Mensaje libre (hasta 640 caracteres). Usa `text` **o** `template`. |
| `template` | texto | `slug` de una plantilla **activa**. |
| `vars` | objeto | Valores para las variables de la plantilla: `{"hora": "5 pm"}`. |
| `sendAt` | texto ISO 8601 | Opcional. Hora mínima de salida, p. ej. `2026-10-10T15:00:00Z`. |

Variables: `{nombre}` se reemplaza con el **primer nombre** del contacto si el teléfono existe en
Contactos (puedes forzarlo con `vars.nombre`). Una variable sin valor se elimina del texto y se limpian
los espacios. Funciona igual en `text` y en las variantes de una plantilla.

**Respuesta `202 Accepted`:**

```json
{
  "messages": [
    { "id": "mq87suooerfpb7f", "phone": "+527722006258", "scheduledAt": "2026-10-08T20:52:56.775Z" }
  ],
  "skipped": [
    { "phone": "abc", "reason": "teléfono inválido" }
  ]
}
```

`skipped` lista a quien no se envió y por qué: `teléfono inválido`, `se dio de baja`, `mensaje vacío`,
`mensaje demasiado largo (máx. 640)`. Si **ninguno** es válido, la respuesta es `400`.

#### Mensaje simple

```bash
curl -X POST $BASE/api/v1/send \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"phone": "7731234567", "text": "Tu pedido va en camino"}'
```

#### Con plantilla

Cada destinatario recibe **una de las variantes** de la plantilla elegida al azar, sin repetir la misma
en dos envíos seguidos.

```bash
curl -X POST $BASE/api/v1/send \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"phone": "7731234567", "template": "recordatorio", "vars": {"hora": "5 pm"}}'
```

#### A varios destinatarios

```bash
curl -X POST $BASE/api/v1/send \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"phones": ["7731234567", "7739876543"], "template": "recordatorio", "vars": {"hora": "5 pm"}}'
```

Los mensajes salen uno a uno con pausas aleatorias; el último puede tardar varios minutos. Cada uno
trae su propia `scheduledAt`.

#### Programar para más tarde

```bash
curl -X POST $BASE/api/v1/send \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"phone": "7731234567", "text": "Hola", "sendAt": "2026-10-10T15:00:00Z"}'
```

`sendAt` es la hora **más temprana** posible: si cae fuera del horario permitido o el día ya llegó al
tope, el mensaje se mueve al siguiente hueco disponible (mira `scheduledAt` en la respuesta).

#### JavaScript (Node 18+)

```js
const res = await fetch(`${process.env.SMS_BASE}/api/v1/send`, {
  method: 'POST',
  headers: { 'X-API-Key': process.env.SMS_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '7731234567', template: 'recordatorio', vars: { hora: '5 pm' } }),
})
if (!res.ok) throw new Error(`SMS ${res.status}: ${(await res.json()).message}`)
const { messages, skipped } = await res.json()
console.log(messages[0].id, messages[0].scheduledAt, skipped)
```

#### Python

```python
import os, requests

r = requests.post(
    f"{os.environ['SMS_BASE']}/api/v1/send",
    headers={"X-API-Key": os.environ["SMS_KEY"]},
    json={"phone": "7731234567", "text": "Tu pedido va en camino"},
    timeout=15,
)
r.raise_for_status()
print(r.json()["messages"][0])
```

---

## Consultar el estado de un mensaje

### `GET /api/v1/messages/{id}`

```bash
curl $BASE/api/v1/messages/mq87suooerfpb7f -H "X-API-Key: $KEY"
```

```json
{
  "id": "mq87suooerfpb7f",
  "phone": "+527722006258",
  "state": "delivered",
  "scheduledAt": "2026-10-08 20:52:56.775Z",
  "error": ""
}
```

El estado se actualiza aproximadamente **cada minuto**. Línea de tiempo normal:
`pending` → `queued` → `sent` → `delivered`. Consúltalo cada 15–30 s como mucho; no hace falta más
frecuencia. Para un fallo, `error` trae el motivo (por ejemplo `RESULT_RIL_MODEM_ERR` suele indicar
SIM sin saldo o sin servicio de SMS).

---

## Contactos

Objeto contacto:

```json
{
  "id": "uie0fgj5rvz8xho",
  "name": "Ana Pérez",
  "phone": "+527731234567",
  "consent": true,
  "optedOut": false,
  "notes": "",
  "created": "2026-10-08 21:20:30.395Z"
}
```

- `consent`: la persona aceptó recibir mensajes. Las **campañas** solo se envían a contactos con
  consentimiento; los envíos por API a un número cualquiera no lo exigen (tú eres responsable de tener
  su permiso).
- `optedOut`: respondió BAJA/STOP/ALTO/CANCELAR. Es **solo lectura**: ningún sistema puede reactivar a
  quien pidió salir. Mientras sea `true`, ni la API ni las campañas le envían.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/v1/contacts` | Lista. Parámetros: `q` (busca en nombre y teléfono), `page` (1), `perPage` (50, máx. 200). Devuelve `{items, page, perPage, total}`. |
| `GET /api/v1/contacts/{id}` | Un contacto. `404` si no existe. |
| `POST /api/v1/contacts` | Crea. Campos: `phone` (obligatorio), `name` (≤120), `consent` (por defecto `false`), `notes` (≤300). `201`. |
| `GET /api/v1/contacts/by-phone/{phone}` | ¿Existe? Normaliza el teléfono (`773 123 4567` = `7731234567`). Devuelve `{exists, contact}` (`contact` es `null` si no existe). |
| `POST /api/v1/contacts/ensure` | "Crear si no existe". Mismos campos que el alta. Si el teléfono ya existe devuelve el contacto sin modificarlo (`200`, `created: false`); si no, lo crea (`201`, `created: true`). Nunca responde `409`. |
| `PATCH /api/v1/contacts/{id}` | Actualiza solo los campos enviados: `name`, `phone`, `consent`, `notes`. |
| `DELETE /api/v1/contacts/{id}` | Elimina (`204`). Los mensajes anteriores se conservan en el historial. |

Un teléfono repetido responde `409` con el `id` del contacto existente en el mensaje.

```bash
# Crear
curl -X POST $BASE/api/v1/contacts -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name": "Ana Pérez", "phone": "7731234567", "consent": true}'

# Guardar solo si no existe (ideal para el formulario de tu web)
curl -X POST $BASE/api/v1/contacts/ensure -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name": "Ana Pérez", "phone": "773 123 4567", "consent": true}'

# Verificar si existe
curl "$BASE/api/v1/contacts/by-phone/7731234567" -H "X-API-Key: $KEY"

# Buscar por teléfono o nombre
curl "$BASE/api/v1/contacts?q=7731234567" -H "X-API-Key: $KEY"

# Actualizar
curl -X PATCH $BASE/api/v1/contacts/ID -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name": "Ana P.", "consent": true}'

# Eliminar
curl -X DELETE $BASE/api/v1/contacts/ID -H "X-API-Key: $KEY"
```

---

## Plantillas

Una plantilla tiene un `slug` (identificador único: `a-z`, `0-9`, `-`, `_`, máx. 60), un nombre y de **1 a
5 variantes**. Las variantes pueden usar `{nombre}` y cualquier otra variable (`{hora}`, `{codigo}`…).

```json
{
  "slug": "recordatorio",
  "name": "Recordatorio de cita",
  "active": true,
  "variants": [
    "Hola {nombre}, te recordamos tu cita a las {hora}.",
    "{nombre}, tu cita es a las {hora}. ¡Te esperamos!",
    "Recordatorio: cita a las {hora}."
  ]
}
```

| Método y ruta | Qué hace |
|---|---|
| `GET /api/v1/templates` | Lista las **activas**. Con `?all=1` incluye las inactivas. |
| `GET /api/v1/templates/{slug}` | Una plantilla. `404` si no existe. |
| `POST /api/v1/templates` | Crea. Campos: `name`, `slug`, `variants` (1–5 textos no vacíos), `active` (por defecto `true`). `201`. `409` si el slug existe. |
| `PATCH /api/v1/templates/{slug}` | Actualiza `name`, `variants` (reemplaza **todas**) o `active`. El `slug` no cambia. |
| `DELETE /api/v1/templates/{slug}` | Elimina (`204`). |

Una plantilla **inactiva** no se puede usar para enviar (`404`).

```bash
curl -X POST $BASE/api/v1/templates -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name": "Recordatorio", "slug": "recordatorio",
       "variants": ["Hola {nombre}, tu cita es a las {hora}",
                    "{nombre}, te esperamos a las {hora}",
                    "Recordatorio: cita a las {hora}"]}'
```

---

## Recetas

### Enviar y esperar la confirmación

```python
import os, time, requests

BASE, KEY = os.environ["SMS_BASE"], os.environ["SMS_KEY"]
H = {"X-API-Key": KEY}

msg = requests.post(f"{BASE}/api/v1/send", headers=H,
                    json={"phone": "7731234567", "text": "Tu código es 482913"}, timeout=15).json()["messages"][0]

for _ in range(40):                         # hasta ~20 min
    st = requests.get(f"{BASE}/api/v1/messages/{msg['id']}", headers=H, timeout=15).json()
    if st["state"] in ("delivered", "failed", "cancelled"):
        break
    time.sleep(30)
print(st["state"], st["error"])
```

### Sincronizar un contacto desde tu CRM (crear o actualizar)

```python
def upsert_contact(name, phone, consent):
    found = requests.get(f"{BASE}/api/v1/contacts", headers=H, params={"q": phone}, timeout=15).json()["items"]
    if found:
        return requests.patch(f"{BASE}/api/v1/contacts/{found[0]['id']}", headers=H,
                              json={"name": name, "consent": consent}, timeout=15).json()
    return requests.post(f"{BASE}/api/v1/contacts", headers=H,
                         json={"name": name, "phone": phone, "consent": consent}, timeout=15).json()
```

> Para buscar por teléfono usa el formato con el que lo guardaste (`+52…`); `q` busca texto parcial.

### Respetar las bajas

Antes de mostrar o exportar tu lista, consulta `GET /api/v1/contacts` y excluye los que tengan
`"optedOut": true`. De todos modos el servidor nunca les envía: aparecerán en `skipped` con
`"reason": "se dio de baja"`.

### Mantener plantillas desde tu repositorio

Guarda tus plantillas como JSON y aplícalas en tu despliegue: `GET /api/v1/templates/{slug}`; si
responde `404`, `POST`; si existe, `PATCH` con las variantes nuevas.

---

## Errores

Las respuestas de error tienen siempre esta forma:

```json
{ "status": 400, "message": "Teléfono inválido.", "data": {} }
```

| Código | Cuándo |
|---|---|
| `400` | Datos inválidos: teléfono, slug, número de variantes, `sendAt` mal formado, ningún destinatario válido, mensaje vacío. |
| `401` | Falta `X-API-Key` o es incorrecta. |
| `404` | Contacto, plantilla o mensaje inexistente; plantilla inactiva al enviar. |
| `409` | Teléfono o slug repetido. |
| `503` | El servidor no tiene configuradas las credenciales del gateway (`GATEWAY_API_USER`/`GATEWAY_API_PASS`). |

Un `202` significa "aceptado y en cola", **no** "entregado": consulta el estado con
`GET /api/v1/messages/{id}`.

---

## Límites y configuración

Los límites están en el servidor (variables de entorno en Coolify); la API no puede saltárselos:

| Variable | Por defecto | Efecto |
|---|---|---|
| `API_MIN_DELAY` / `API_MAX_DELAY` | 20 / 60 s | Pausa aleatoria entre mensajes enviados por API o desde "Nuevo mensaje". |
| `MIN_DELAY_FLOOR` | 20 s | Pausa mínima absoluta (también para campañas). |
| `API_WINDOW_START` / `API_WINDOW_END` | 8 / 22 | Horario permitido (hora local). Fuera de él, el mensaje se mueve al día siguiente. |
| `MAX_PER_DAY` | 150 | Tope diario **compartido** entre API, web y campañas. |
| `API_MAX_BATCH` | 20 | Destinatarios máximos por llamada a `/send`. |
| `TZ_OFFSET_MIN` | -360 | Zona horaria en minutos respecto a UTC (México: -360). |

Consecuencia práctica: no esperes envío instantáneo. Para códigos de verificación urgentes, considera
una ventana horaria amplia (`API_WINDOW_START=0`, `API_WINDOW_END=24`) y pausas cortas, sabiendo que
enviar muchos mensajes seguidos a una misma línea aumenta el riesgo de que la operadora la bloquee.

---

## Lo que la API no hace

Por ahora estas acciones **solo existen en la web**:

- Crear, pausar, reanudar o cancelar **campañas**.
- **Cancelar** o **reintentar** un mensaje concreto.
- Recibir avisos (webhooks) hacia tu sistema cuando cambia un estado: se consulta con `GET` (polling).
- Leer los SMS que responden tus contactos (solo se procesa BAJA/STOP/ALTO/CANCELAR para las bajas).
