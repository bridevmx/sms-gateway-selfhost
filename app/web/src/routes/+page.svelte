<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Badge from '#lib/components/Badge.svelte'
  import Alert from '#lib/components/Alert.svelte'
  import { CAMPAIGN_LABEL, CAMPAIGN_CLASS, STATE_LABEL, STATE_CLASS, fmtDate, errMsg } from '#lib/format.js'

  let status = $state(null)
  let campaigns = $state([])
  let counts = $state({})
  let apiMessages = $state([])
  let error = $state('')

  async function load() {
    try {
      const [camps, msgs, api] = await Promise.all([
        pb.collection('campaigns').getFullList({ sort: '-created' }),
        pb.collection('messages').getFullList({ filter: "source = 'campaign'", fields: 'campaign,state', batch: 1000 }),
        pb.collection('messages').getList(1, 8, { filter: "source = 'api'", sort: '-created' }),
      ])
      const c = {}
      for (const m of msgs) {
        c[m.campaign] ??= { total: 0 }
        c[m.campaign].total++
        c[m.campaign][m.state] = (c[m.campaign][m.state] || 0) + 1
      }
      campaigns = camps
      counts = c
      apiMessages = api.items
      error = ''
    } catch (err) {
      error = errMsg(err)
    }
    try {
      status = await pb.send('/api/app/status', {})
    } catch (err) {
      status = { gatewayOk: false, error: errMsg(err), devices: [] }
    }
  }

  onMount(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  })

  const done = (id) => (counts[id]?.delivered || 0) + (counts[id]?.sent || 0)
  const pct = (id) => (counts[id]?.total ? Math.round((done(id) / counts[id].total) * 100) : 0)
</script>

<h1 class="text-2xl font-semibold mb-4">Inicio</h1>
<Alert message={error} />

<section aria-labelledby="gw-title" class="card bg-base-200 p-4 mb-6">
  <h2 id="gw-title" class="font-semibold mb-2">Gateway</h2>
  {#if !status}
    <span class="loading loading-spinner loading-sm"></span>
  {:else}
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <Badge label={status.gatewayOk ? 'Conectado' : 'Sin conexión'} cls={status.gatewayOk ? 'badge-success' : 'badge-error'} />
      {#each status.devices as d}
        <span>Dispositivo {d.name || d.id} · última vez {fmtDate(d.lastSeen)}</span>
      {/each}
      {#if status.error}<span class="text-error">{status.error}</span>{/if}
      {#if status.limits}
        <span class="opacity-70">
          Mín. {status.limits.minDelayFloor}s entre mensajes · tope {status.limits.maxPerDay}/día
        </span>
      {/if}
      {#if status.apiKeyConfigured === false}<span class="text-warning">API_KEY sin configurar</span>{/if}
    </div>
  {/if}
</section>

<section aria-labelledby="camp-title" class="mb-8">
  <div class="flex items-center justify-between mb-2">
    <h2 id="camp-title" class="font-semibold">Campañas</h2>
    <a href="/campaigns/new" class="btn btn-primary btn-sm">Nueva campaña</a>
  </div>
  {#if campaigns.length === 0}
    <p class="opacity-70 text-sm">Aún no hay campañas.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr><th>Nombre</th><th>Estado</th><th>Inicio</th><th>Avance</th><th></th></tr>
        </thead>
        <tbody>
          {#each campaigns as c (c.id)}
            <tr>
              <td class="font-medium">{c.name}</td>
              <td><Badge label={CAMPAIGN_LABEL[c.status]} cls={CAMPAIGN_CLASS[c.status]} /></td>
              <td>{fmtDate(c.start_at)}</td>
              <td class="min-w-40">
                {#if counts[c.id]}
                  <progress class="progress progress-primary w-28" value={pct(c.id)} max="100"></progress>
                  <span class="text-xs ml-1">{done(c.id)}/{counts[c.id].total}</span>
                  {#if counts[c.id].failed}<span class="text-xs text-error ml-1">{counts[c.id].failed} fallidos</span>{/if}
                {:else}—{/if}
              </td>
              <td><a class="btn btn-ghost btn-xs" href="/campaigns/{c.id}">Ver</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<section aria-labelledby="api-title">
  <h2 id="api-title" class="font-semibold mb-2">Últimos envíos por API</h2>
  {#if apiMessages.length === 0}
    <p class="opacity-70 text-sm">Sin envíos por API todavía. Consulta la pestaña API.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Teléfono</th><th>Mensaje</th><th>Programado</th><th>Estado</th></tr></thead>
        <tbody>
          {#each apiMessages as m (m.id)}
            <tr>
              <td>{m.phone}</td>
              <td class="max-w-xs truncate">{m.text}</td>
              <td>{fmtDate(m.scheduled_at)}</td>
              <td><Badge label={STATE_LABEL[m.state]} cls={STATE_CLASS[m.state]} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
