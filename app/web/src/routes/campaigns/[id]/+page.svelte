<script>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import pb from '#lib/pb.js'
  import Badge from '#lib/components/Badge.svelte'
  import Alert from '#lib/components/Alert.svelte'
  import { CAMPAIGN_LABEL, CAMPAIGN_CLASS, STATE_LABEL, STATE_CLASS, fmtDate, errMsg } from '#lib/format.js'

  const id = page.params.id

  let campaign = $state(null)
  let messages = $state([])
  let error = $state('')
  let info = $state('')
  let busy = $state(false)
  let filter = $state('')

  async function load() {
    try {
      campaign = await pb.collection('campaigns').getOne(id)
      messages = await pb.collection('messages').getFullList({ filter: `campaign = "${id}"`, sort: 'scheduled_at', batch: 1000 })
    } catch (err) {
      error = errMsg(err)
    }
  }

  onMount(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  })

  const counts = $derived.by(() => {
    const c = { total: messages.length }
    for (const m of messages) c[m.state] = (c[m.state] || 0) + 1
    return c
  })
  const doneCount = $derived((counts.delivered || 0) + (counts.sent || 0))
  const shown = $derived(filter ? messages.filter((m) => m.state === filter) : messages)

  async function act(action, label) {
    if (action === 'cancel' && !confirm('¿Cancelar la campaña? Los mensajes pendientes no se enviarán.')) return
    busy = true
    error = info = ''
    try {
      const r = await pb.send(`/api/app/campaigns/${id}/${action}`, { method: 'POST' })
      info = `${label}: listo` + (r.retried !== undefined ? ` (${r.retried} reintentados)` : '')
      await load()
    } catch (err) {
      error = errMsg(err)
    } finally {
      busy = false
    }
  }

  const variantsOf = (c) => [c.v1, c.v2, c.v3, c.v4, c.v5].filter(Boolean)
</script>

<a href="/" class="text-sm opacity-70">← Inicio</a>

{#if campaign}
  <div class="flex flex-wrap items-center gap-3 my-3">
    <h1 class="text-2xl font-semibold">{campaign.name}</h1>
    <Badge label={CAMPAIGN_LABEL[campaign.status]} cls={CAMPAIGN_CLASS[campaign.status]} />
  </div>

  <Alert message={error} />
  <Alert type="success" message={info} />

  <div class="flex flex-wrap gap-2 my-3">
    {#if campaign.status === 'running'}
      <button class="btn btn-warning btn-sm" disabled={busy} onclick={() => act('pause', 'Pausa')}>Pausar</button>
    {/if}
    {#if campaign.status === 'paused'}
      <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => act('resume', 'Reanudar')}>Reanudar</button>
    {/if}
    {#if campaign.status === 'running' || campaign.status === 'paused'}
      <button class="btn btn-error btn-outline btn-sm" disabled={busy} onclick={() => act('cancel', 'Cancelar')}>Cancelar</button>
    {/if}
    {#if counts.failed && campaign.status !== 'cancelled'}
      <button class="btn btn-sm" disabled={busy} onclick={() => act('retry-failed', 'Reintento')}>Reintentar {counts.failed} fallidos</button>
    {/if}
  </div>

  <div class="stats stats-vertical sm:stats-horizontal bg-base-200 w-full mb-4">
    <div class="stat py-2"><div class="stat-title">Total</div><div class="stat-value text-2xl">{counts.total}</div></div>
    <div class="stat py-2"><div class="stat-title">Enviados</div><div class="stat-value text-2xl">{doneCount}</div></div>
    <div class="stat py-2"><div class="stat-title">Pendientes</div><div class="stat-value text-2xl">{(counts.pending || 0) + (counts.queued || 0)}</div></div>
    <div class="stat py-2"><div class="stat-title">Fallidos</div><div class="stat-value text-2xl text-error">{counts.failed || 0}</div></div>
  </div>

  <details class="mb-4">
    <summary class="cursor-pointer text-sm">Variantes y ritmo</summary>
    <ul class="list-disc pl-5 text-sm mt-2">
      {#each variantsOf(campaign) as v}<li>{v}</li>{/each}
    </ul>
    <p class="text-xs opacity-70 mt-2">
      Pausa {campaign.min_delay}–{campaign.max_delay}s · máx. {campaign.daily_limit}/día · horario {campaign.window_start}:00–{campaign.window_end}:00
    </p>
  </details>

  <div class="flex items-center gap-2 mb-2">
    <label for="state-filter" class="text-sm">Filtrar</label>
    <select id="state-filter" class="select select-bordered select-sm" bind:value={filter}>
      <option value="">Todos</option>
      {#each Object.keys(STATE_LABEL) as s}<option value={s}>{STATE_LABEL[s]}</option>{/each}
    </select>
  </div>

  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead><tr><th>Teléfono</th><th>Var.</th><th>Programado</th><th>Estado</th><th>Detalle</th></tr></thead>
      <tbody>
        {#each shown as m (m.id)}
          <tr>
            <td>{m.phone}</td>
            <td>{m.variant}</td>
            <td>{fmtDate(m.scheduled_at)}</td>
            <td><Badge label={STATE_LABEL[m.state]} cls={STATE_CLASS[m.state]} /></td>
            <td class="text-xs text-error max-w-xs truncate" title={m.error}>{m.error}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if error}
  <Alert message={error} />
{:else}
  <span class="loading loading-spinner"></span>
{/if}
