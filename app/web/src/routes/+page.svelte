<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import StatCard from '#lib/components/StatCard.svelte'
  import StatusPill from '#lib/components/StatusPill.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import { STATE, CAMPAIGN, SOURCE, fmtRelative, errMsg } from '#lib/format.js'

  let week = $state([])
  let upcoming = $state(0)
  let recent = $state([])
  let running = $state([])
  let limits = $state(null)
  let gw = $state(null)
  let error = $state('')
  let loaded = $state(false)

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  async function load() {
    try {
      const from = new Date(startOfDay(new Date()).getTime() - 6 * 86400000).toISOString().replace('T', ' ')
      const [rows, up, rec, camps, st] = await Promise.all([
        pb.collection('messages').getFullList({
          filter: pb.filter('scheduled_at >= {:from}', { from }),
          fields: 'state,scheduled_at',
          batch: 1000,
        }),
        pb.collection('messages').getList(1, 1, { filter: "state = 'pending' || state = 'queued'", fields: 'id' }),
        pb.collection('messages').getList(1, 7, { sort: '-created', expand: 'contact' }),
        pb.collection('campaigns').getFullList({ filter: "status = 'running' || status = 'paused'", sort: '-created' }),
        pb.send('/api/app/status', {}),
      ])
      week = rows
      upcoming = up.totalItems
      recent = rec.items
      running = camps
      limits = st.limits
      gw = st
      error = ''
    } catch (err) {
      error = errMsg(err)
    } finally {
      loaded = true
    }
  }

  onMount(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  })

  const days = $derived.by(() => {
    const today = startOfDay(new Date()).getTime()
    const out = []
    for (let i = 6; i >= 0; i--) {
      const t = today - i * 86400000
      out.push({ t, label: new Date(t).toLocaleDateString('es-MX', { weekday: 'short' }), ok: 0, fail: 0, wait: 0 })
    }
    for (const m of week) {
      const d = new Date(String(m.scheduled_at).replace(' ', 'T'))
      const idx = Math.floor((startOfDay(d).getTime() - out[0].t) / 86400000)
      if (idx < 0 || idx > 6) continue
      if (m.state === 'delivered' || m.state === 'sent') out[idx].ok++
      else if (m.state === 'failed') out[idx].fail++
      else if (m.state === 'pending' || m.state === 'queued') out[idx].wait++
    }
    return out
  })
  const peak = $derived(Math.max(1, ...days.map((d) => d.ok + d.fail + d.wait)))
  const today = $derived(days[6] || { ok: 0, fail: 0, wait: 0 })
  const sentToday = $derived(today.ok)
  const usedToday = $derived(today.ok + today.wait)
  const totals = $derived.by(() => {
    let delivered = 0, sent = 0, failed = 0
    for (const m of week) {
      if (m.state === 'delivered') delivered++
      else if (m.state === 'sent') sent++
      else if (m.state === 'failed') failed++
    }
    return { delivered, sent, failed }
  })
  const rate = $derived.by(() => {
    const done = totals.delivered + totals.sent + totals.failed
    return done ? Math.round(((totals.delivered + totals.sent) / done) * 100) : null
  })
</script>

<PageHeader title="Resumen" description="Actividad de tu línea de SMS en los últimos 7 días.">
  {#snippet actions()}
    <a href="/compose" class="btn btn-primary btn-sm gap-1.5"><Icon name="send" size={15} /> Nuevo mensaje</a>
  {/snippet}
</PageHeader>

<Alert message={error} />
{#if gw && gw.error}
  <div class="mb-4"><Alert type="warning" message="{gw.error}. Revisa GATEWAY_API_USER y GATEWAY_API_PASS en el servidor." /></div>
{/if}

<section aria-label="Métricas" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <StatCard label="Enviados hoy" value={sentToday} icon="send" tone="primary"
    hint={limits ? `${usedToday} de ${limits.maxPerDay} permitidos hoy` : ''} />
  <StatCard label="Tasa de entrega" value={rate === null ? '—' : rate + '%'} icon="check" tone="success"
    hint="Últimos 7 días" />
  <StatCard label="En cola" value={upcoming} icon="clock" tone="info" hint="Programados y por salir" />
  <StatCard label="Fallidos" value={totals.failed} icon="alert" tone={totals.failed ? 'error' : ''} hint="Últimos 7 días" />
</section>

<div class="mt-4 grid gap-4 lg:grid-cols-5">
  <section aria-labelledby="chart-title" class="rounded-box border border-base-300 bg-base-100 p-5 lg:col-span-3">
    <div class="flex items-center justify-between">
      <h2 id="chart-title" class="font-medium">Mensajes por día</h2>
      <div class="flex items-center gap-3 text-xs text-base-content/60">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-success"></span>Enviados</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-info/60"></span>En cola</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded-sm bg-error"></span>Fallidos</span>
      </div>
    </div>
    <div class="mt-5 flex h-44 items-end gap-3" role="img" aria-label="Gráfica de mensajes por día">
      {#each days as d}
        {@const total = d.ok + d.fail + d.wait}
        <div class="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span class="text-xs tabular-nums text-base-content/50">{total || ''}</span>
          <div class="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md bg-base-200" style="height: {Math.max(4, (total / peak) * 100)}%">
            <div class="bg-success" style="flex: {d.ok}"></div>
            <div class="bg-info/60" style="flex: {d.wait}"></div>
            <div class="bg-error" style="flex: {d.fail}"></div>
          </div>
          <span class="text-xs capitalize text-base-content/60">{d.label}</span>
        </div>
      {/each}
    </div>
  </section>

  <section aria-labelledby="run-title" class="rounded-box border border-base-300 bg-base-100 p-5 lg:col-span-2">
    <div class="flex items-center justify-between">
      <h2 id="run-title" class="font-medium">Campañas activas</h2>
      <a href="/campaigns" class="text-xs text-primary hover:underline">Ver todas</a>
    </div>
    {#if running.length === 0}
      <p class="py-10 text-center text-sm text-base-content/50">No hay campañas en curso.</p>
    {:else}
      <ul class="mt-3 grid gap-2">
        {#each running as c (c.id)}
          <li>
            <a href="/campaigns/{c.id}" class="flex items-center justify-between gap-3 rounded-lg border border-base-300 px-3 py-2.5 hover:bg-base-200">
              <span class="truncate text-sm font-medium">{c.name}</span>
              <StatusPill meta={CAMPAIGN[c.status]} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<section aria-labelledby="recent-title" class="mt-4 rounded-box border border-base-300 bg-base-100">
  <div class="flex items-center justify-between px-5 py-4">
    <h2 id="recent-title" class="font-medium">Actividad reciente</h2>
    <a href="/messages" class="text-xs text-primary hover:underline">Ver todos los mensajes</a>
  </div>
  {#if loaded && recent.length === 0}
    <EmptyState icon="inbox" title="Aún no hay mensajes" text="Envía el primero desde Nuevo mensaje o por la API.">
      {#snippet action()}<a href="/compose" class="btn btn-primary btn-sm">Nuevo mensaje</a>{/snippet}
    </EmptyState>
  {:else}
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr class="text-xs text-base-content/50"><th>Destinatario</th><th>Mensaje</th><th>Origen</th><th>Estado</th><th class="text-right">Cuándo</th></tr>
        </thead>
        <tbody>
          {#each recent as m (m.id)}
            <tr class="hover:bg-base-200/50">
              <td>
                <div class="font-medium">{m.expand?.contact?.name || m.phone}</div>
                {#if m.expand?.contact?.name}<div class="text-xs text-base-content/50">{m.phone}</div>{/if}
              </td>
              <td class="max-w-64 truncate text-base-content/70">{m.text}</td>
              <td class="text-base-content/70">{SOURCE[m.source] || '—'}</td>
              <td><StatusPill meta={STATE[m.state]} /></td>
              <td class="text-right text-base-content/60">{fmtRelative(m.scheduled_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
