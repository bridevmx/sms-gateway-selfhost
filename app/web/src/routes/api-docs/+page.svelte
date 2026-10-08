<script>
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import { errMsg } from '#lib/format.js'

  const base = window.location.origin
  let info = $state('')
  let error = $state('')

  const simple = `curl -X POST ${base}/api/v1/send \\
  -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" \\
  -d '{"phone": "7731234567", "text": "Tu pedido va en camino"}'`

  const template = `curl -X POST ${base}/api/v1/send \\
  -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" \\
  -d '{"phone": "7731234567", "template": "recordatorio",
       "vars": {"nombre": "Ana", "hora": "5 pm"}}'`

  const status = `curl ${base}/api/v1/messages/ID_DEL_MENSAJE -H "X-API-Key: TU_API_KEY"`

  async function registerWebhook() {
    info = error = ''
    try {
      const r = await pb.send('/api/app/gateway/webhook', { method: 'POST' })
      info = `Gateway respondió ${r.status}`
    } catch (err) {
      error = errMsg(err)
    }
  }
</script>

<h1 class="text-2xl font-semibold mb-2">API de envíos</h1>
<p class="text-sm opacity-70 mb-4">
  Autenticación con la cabecera <code>X-API-Key</code> (variable <code>API_KEY</code> del servidor). Los envíos entran en la misma cola
  que las campañas: respetan pausas aleatorias, horario y tope diario, así que la respuesta devuelve la hora programada.
</p>

<section class="grid gap-4">
  <div>
    <h2 class="font-semibold mb-1">Mensaje simple</h2>
    <pre class="bg-base-200 rounded-box p-3 text-xs overflow-x-auto">{simple}</pre>
  </div>
  <div>
    <h2 class="font-semibold mb-1">Con plantilla (elige una variante al azar)</h2>
    <pre class="bg-base-200 rounded-box p-3 text-xs overflow-x-auto">{template}</pre>
  </div>
  <div>
    <h2 class="font-semibold mb-1">Consultar estado</h2>
    <pre class="bg-base-200 rounded-box p-3 text-xs overflow-x-auto">{status}</pre>
  </div>
  <div class="text-sm">
    <h2 class="font-semibold mb-1">Detalles</h2>
    <ul class="list-disc pl-5 grid gap-1">
      <li><code>phone</code> o <code>phones</code> (máx. 20). Se normaliza a +52 si trae 10 dígitos.</li>
      <li><code>text</code> (hasta 640) o <code>template</code> + <code>vars</code>. <code>{'{nombre}'}</code> se toma del contacto si existe.</li>
      <li><code>sendAt</code> opcional (ISO 8601) para programar. Respuesta <code>202</code> con <code>messages[].id</code> y <code>scheduledAt</code>.</li>
      <li>Estados: pending, queued, sent, delivered, failed, cancelled.</li>
      <li>Los números que respondieron BAJA se omiten y aparecen en <code>skipped</code>.</li>
      <li><code>GET /api/v1/templates</code> lista las plantillas activas.</li>
    </ul>
  </div>

  <div class="card bg-base-200 p-4 gap-2">
    <h2 class="font-semibold">Bajas automáticas (BAJA)</h2>
    <p class="text-sm opacity-70">
      Registra en el gateway el webhook de SMS recibidos para marcar como baja a quien responda BAJA, STOP o ALTO.
      Requiere <code>PUBLIC_URL</code> y <code>WEBHOOK_SECRET</code> en el servidor.
    </p>
    <button class="btn btn-sm self-start" onclick={registerWebhook}>Registrar webhook</button>
    <Alert message={error} />
    <Alert type="success" message={info} />
  </div>
</section>
