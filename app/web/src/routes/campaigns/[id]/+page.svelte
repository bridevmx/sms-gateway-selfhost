<script>
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import StatCard from '#lib/components/StatCard.svelte'
  import StatusPill from '#lib/components/StatusPill.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { CAMPAIGN, STATE, fmtDate, fmtRelative, errMsg } from '#lib/format.js'

  const id = page.params.id

  let campaign = $state(null)
  let messages = $state([])
  let error = $state('')
  let busy = $state(false)
  let filter = $state('')
  let cancelOpen = $state(false)

  async function load() {
    try {
      campaign = await pb.collection('campaigns').getOne(id)
      messages = await pb.collection('messages').getFullList({
        filter: pb.filter('campaign = {:id}', { id }),
        sort: 'scheduled_at',
        expand: 'contact',
        batch: 1000,
      })
      error = ''
    } catch (err) {
      error = errMsg(err)
    }
  }

  onMount(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  })

  const counts = $derived.by(() => {
    const c = { total: messages.length }
    for (const m of messages) c[m.state] = (c[m.state] || 0) + 1
    return c
  })
  const doneCount = $derived((counts.delivered || 0) + (counts.sent || 0))
  const pct = $derived(counts.total ? Math.round((doneCount / counts.total) * 100) : 0)
  const waiting = $derived((counts.pending || 0) + (counts.queued || 0))
  const next = $derived(messages.find((m) => m.state === 'pending' || m.state === 'queued'))
  const shown = $derived(filter ? messages.filter((m) => m.state === filter) : messages)
  const variants = $derived(campaign ? [campaign.v1, campaign.v2, campaign.v3, campaign.v4, campaign.v5].filter(Boolean) : [])

  async function act(action, okMsg) {
    busy = true
    try {
      await pb.send(`/api/app/campaigns/${id}/${action}`, { method: 'POST' })
      toast(okMsg)
      await load()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      busy = false
      cancelOpen = false
    }
  }
</script>

<a href="/campaigns" class="mb-3 inline-flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content">
  <Icon name="chevronL" size={14} /> Campañas
</a>

{#if campaign}
  <PageHeader title={campaign.name}>
    {#snippet actions()}
      <StatusPill meta={CAMPAIGN[campaign.status]} />
      {#if campaign.status === 'running'}
        <button class="btn btn-sm gap-1.5" disabled={busy} onclick={() => act('pause', 'Campaña en pausa')}><Icon name="pause" size={14} /> Pausar</button>
      {/if}
      {#if campaign.status === 'paused'}
        <button class="btn btn-primary btn-sm gap-1.5" disabled={busy} onclick={() => act('resume', 'Campaña reanudada')}><Icon name="play" size={14} /> Reanudar</button>
      {/if}
      {#if counts.failed && campaign.status !== 'cancelled'}
        <button class="btn btn-sm gap-1.5" disabled={busy} onclick={() => act('retry-failed', 'Fallidos reprogramados')}><Icon name="refresh" size={14} /> Reintentar {counts.failed}</button>
      {/if}
      {#if campaign.status === 'running' || campaign.status === 'paused'}
        <button class="btn btn-error btn-outline btn-sm gap-1.5" disabled={busy} onclick={() => (cancelOpen = true)}><Icon name="ban" size={14} /> Cancelar</button>
      {/if}
    {/snippet}
  </PageHeader>

  <Alert message={error} />

  <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Métricas de la campaña">
    <StatCard label="Destinatarios" value={counts.total} icon="users" />
    <StatCard label="Enviados" value={doneCount} icon="check" tone="success" hint="{pct}% completado" />
    <StatCard label="Por enviar" value={waiting} icon="clock" tone="info" hint={next ? `Siguiente ${fmtRelative(next.scheduled_at)}` : ''} />
    <StatCard label="Fallidos" value={counts.failed || 0} icon="alert" tone={counts.failed ? 'error' : ''} />
  </section>

  <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-base-300" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
    <div class="h-full bg-primary transition-all" style="width: {pct}%"></div>
  </div>

  <div class="mt-4 grid gap-4 lg:grid-cols-3">
    <section class="rounded-box border border-base-300 bg-base-100 p-5 lg:col-span-1" aria-labelledby="cfg-title">
      <h2 id="cfg-title" class="mb-3 font-medium">Configuración</h2>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-base-content/50">Inicio</dt><dd>{fmtDate(campaign.start_at)}</dd>
        <dt class="text-base-content/50">Pausa</dt><dd>{campaign.min_delay}–{campaign.max_delay} s</dd>
        <dt class="text-base-content/50">Tope diario</dt><dd>{campaign.daily_limit}</dd>
        <dt class="text-base-content/50">Horario</dt><dd>{campaign.window_start}:00–{campaign.window_end}:00</dd>
        <dt class="text-base-content/50">Baja</dt><dd>{campaign.optout_footer ? `"${campaign.footer_text || 'Responde BAJA para salir'}"` : 'Sin pie de baja'}</dd>
      </dl>
      <h3 class="mb-2 mt-5 text-sm font-medium">Variantes</h3>
      <ul class="grid gap-1.5 text-sm">
        {#each variants as v, i}
          <li class="rounded-lg bg-base-200 px-3 py-2"><span class="mr-1 text-xs text-base-content/40">V{i + 1}</span>{v}</li>
        {/each}
      </ul>
    </section>

    <section class="rounded-box border border-base-300 bg-base-100 lg:col-span-2" aria-labelledby="list-title">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <h2 id="list-title" class="font-medium">Mensajes</h2>
        <select class="select select-sm w-auto" bind:value={filter} aria-label="Filtrar por estado">
          <option value="">Todos</option>
          {#each Object.entries(STATE) as [k, v]}<option value={k}>{v.label}</option>{/each}
        </select>
      </div>
      {#if shown.length === 0}
        <EmptyState icon="inbox" title="Sin mensajes" text="No hay mensajes con este filtro." />
      {:else}
        <div class="max-h-[32rem] overflow-auto">
          <table class="table table-sm">
            <thead class="sticky top-0 bg-base-100">
              <tr class="text-xs text-base-content/50"><th>Destinatario</th><th>Var.</th><th>Programado</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {#each shown as m (m.id)}
                <tr>
                  <td>
                    <div class="font-medium">{m.expand?.contact?.name || m.phone}</div>
                    {#if m.expand?.contact?.name}<div class="text-xs text-base-content/50">{m.phone}</div>{/if}
                  </td>
                  <td class="text-base-content/60">{m.variant}</td>
                  <td class="whitespace-nowrap text-base-content/70">{fmtDate(m.scheduled_at)}</td>
                  <td>
                    <StatusPill meta={STATE[m.state]} />
                    {#if m.error}<div class="mt-0.5 max-w-40 truncate text-xs text-error/80" title={m.error}>{m.error}</div>{/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
{:else if error}
  <Alert message={error} />
{:else}
  <div class="grid place-items-center py-20"><span class="loading loading-spinner"></span></div>
{/if}

<Modal bind:open={cancelOpen} title="Cancelar campaña">
  <p class="text-sm">Los {waiting} mensajes pendientes no se enviarán. Los que ya salieron no se pueden deshacer.</p>
  {#snippet footer()}
    <button class="btn btn-ghost btn-sm" onclick={() => (cancelOpen = false)}>Volver</button>
    <button class="btn btn-error btn-sm" disabled={busy} onclick={() => act('cancel', 'Campaña cancelada')}>Cancelar campaña</button>
  {/snippet}
</Modal>
