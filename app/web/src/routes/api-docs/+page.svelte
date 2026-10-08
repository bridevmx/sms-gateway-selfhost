<script>
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import CopyButton from '#lib/components/CopyButton.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { errMsg } from '#lib/format.js'

  const base = window.location.origin
  let busy = $state(false)

  const examples = [
    {
      title: 'Mensaje simple',
      code: `curl -X POST ${base}/api/v1/send \\
  -H "X-API-Key: TU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "7731234567", "text": "Tu pedido va en camino"}'`,
    },
    {
      title: 'Con plantilla (elige una variante al azar)',
      code: `curl -X POST ${base}/api/v1/send \\
  -H "X-API-Key: TU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "7731234567", "template": "recordatorio",
       "vars": {"nombre": "Ana", "hora": "5 pm"}}'`,
    },
    {
      title: 'Programar y consultar estado',
      code: `# Programar para una hora concreta (ISO 8601)
curl -X POST ${base}/api/v1/send -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" \\
  -d '{"phone": "7731234567", "text": "Hola", "sendAt": "2026-10-10T15:00:00Z"}'

# Estado del mensaje (usa el id de la respuesta)
curl ${base}/api/v1/messages/ID_DEL_MENSAJE -H "X-API-Key: TU_API_KEY"`,
    },
    {
      title: 'Contactos y plantillas (CRUD)',
      code: `# Crear contacto con consentimiento
curl -X POST ${base}/api/v1/contacts -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" \\
  -d '{"name": "Ana Pérez", "phone": "7731234567", "consent": true}'

# Crear plantilla con 3 variantes
curl -X POST ${base}/api/v1/templates -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" \\
  -d '{"name": "Recordatorio", "slug": "recordatorio", "variants": ["Hola {nombre}, tu cita es a las {hora}", "{nombre}, te esperamos a las {hora}", "Recordatorio: cita a las {hora}"]}'

# Actualizar y eliminar
curl -X PATCH ${base}/api/v1/contacts/ID -H "X-API-Key: TU_API_KEY" -H "Content-Type: application/json" -d '{"name": "Ana P."}'
curl -X DELETE ${base}/api/v1/templates/recordatorio -H "X-API-Key: TU_API_KEY"`,
    },
  ]

  const endpoints = [
    {
      group: 'Envíos',
      rows: [
        ['POST', '/api/v1/send', 'Envía a uno o varios números (máx. 20). Responde 202 con id y hora programada.'],
        ['GET', '/api/v1/messages/{id}', 'Estado: pending, queued, sent, delivered, failed o cancelled.'],
      ],
    },
    {
      group: 'Contactos',
      rows: [
        ['GET', '/api/v1/contacts', 'Lista con ?q= (nombre o teléfono), ?page= y ?perPage= (máx. 200).'],
        ['GET', '/api/v1/contacts/{id}', 'Un contacto.'],
        ['POST', '/api/v1/contacts', 'Crea: name, phone, consent, notes. 409 si el teléfono ya existe.'],
        ['PATCH', '/api/v1/contacts/{id}', 'Actualiza name, phone, consent o notes. "optedOut" es solo lectura.'],
        ['DELETE', '/api/v1/contacts/{id}', 'Elimina el contacto (204).'],
      ],
    },
    {
      group: 'Plantillas (por slug)',
      rows: [
        ['GET', '/api/v1/templates', 'Lista las activas; con ?all=1 incluye las inactivas. Devuelve las variantes.'],
        ['GET', '/api/v1/templates/{slug}', 'Una plantilla.'],
        ['POST', '/api/v1/templates', 'Crea: name, slug, variants (1 a 5 textos), active.'],
        ['PATCH', '/api/v1/templates/{slug}', 'Actualiza name, variants o active. El slug no cambia.'],
        ['DELETE', '/api/v1/templates/{slug}', 'Elimina la plantilla (204).'],
      ],
    },
  ]

  async function registerWebhook() {
    busy = true
    try {
      const r = await pb.send('/api/app/gateway/webhook', { method: 'POST' })
      toast(`Gateway respondió ${r.status}`, r.status < 300 ? 'success' : 'error')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="API" description="Integra el envío de SMS en tus sistemas. Comparte cola, pausas aleatorias, horario y tope diario con el resto de la app." />

<section class="grid gap-4" aria-label="Ejemplos">
  <div class="flex items-start gap-3 rounded-box border border-base-300 bg-base-100 p-5 text-sm">
    <Icon name="shield" size={18} class="mt-0.5 shrink-0 text-primary" />
    <div>
      <p class="font-medium">Autenticación</p>
      <p class="mt-1 text-base-content/70">
        Envía la cabecera <code class="rounded bg-base-200 px-1.5 py-0.5">X-API-Key</code> con el valor de la variable
        <code class="rounded bg-base-200 px-1.5 py-0.5">CAMPAIGNS_API_KEY</code> de tu servidor. No la expongas en aplicaciones web o móviles: úsala solo desde tu backend.
      </p>
    </div>
  </div>

  {#each examples as ex}
    <div class="overflow-hidden rounded-box border border-base-300 bg-base-100">
      <div class="flex items-center justify-between border-b border-base-300 px-4 py-2">
        <h2 class="text-sm font-medium">{ex.title}</h2>
        <CopyButton text={ex.code} />
      </div>
      <pre class="overflow-x-auto bg-neutral p-4 text-xs leading-relaxed text-neutral-content"><code>{ex.code}</code></pre>
    </div>
  {/each}

  <div class="overflow-hidden rounded-box border border-base-300 bg-base-100">
    <div class="border-b border-base-300 px-4 py-2"><h2 class="text-sm font-medium">Endpoints</h2></div>
    {#each endpoints as g}
      <p class="bg-base-200/60 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-base-content/50">{g.group}</p>
      <ul class="divide-y divide-base-200 text-sm">
        {#each g.rows as [method, path, desc]}
          <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
            <span class="w-14 rounded bg-primary/10 px-1.5 py-0.5 text-center text-xs font-semibold text-primary">{method}</span>
            <code class="font-mono text-xs">{path}</code>
            <span class="basis-full text-base-content/60 sm:basis-auto">{desc}</span>
          </li>
        {/each}
      </ul>
    {/each}
    <div class="border-t border-base-300 px-4 py-3 text-xs text-base-content/60">
      Parámetros de <code>/send</code>: <code>phone</code> o <code>phones</code>, <code>text</code> (hasta 640) o <code>template</code> + <code>vars</code>, <code>sendAt</code> opcional.
      <code>{'{nombre}'}</code> se toma del contacto si existe. Los números que respondieron BAJA aparecen en <code>skipped</code> y nadie puede reactivarlos por API.
    </div>
  </div>

  <div class="rounded-box border border-base-300 bg-base-100 p-5">
    <h2 class="font-medium">Bajas automáticas (BAJA)</h2>
    <p class="mt-1 text-sm text-base-content/60">
      Registra en el gateway el aviso de SMS recibidos para que quien responda BAJA, STOP o ALTO quede excluido y se cancelen sus pendientes.
      Requiere <code>CAMPAIGNS_PUBLIC_URL</code> y <code>CAMPAIGNS_WEBHOOK_SECRET</code> en el servidor.
    </p>
    <button class="btn btn-sm mt-3" disabled={busy} onclick={registerWebhook}>
      {#if busy}<span class="loading loading-spinner loading-xs"></span>{/if}
      Registrar webhook
    </button>
  </div>
</section>
