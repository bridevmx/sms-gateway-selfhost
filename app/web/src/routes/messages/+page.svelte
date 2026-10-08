<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import StatusPill from '#lib/components/StatusPill.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import Drawer from '#lib/components/Drawer.svelte'
  import Pagination from '#lib/components/Pagination.svelte'
  import PhonePreview from '#lib/components/PhonePreview.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { STATE, SOURCE, fmtDate, fmtRelative, errMsg, downloadCsv } from '#lib/format.js'

  const PER_PAGE = 25
  const ranges = [
    { v: '1', label: 'Últimas 24 h' },
    { v: '7', label: 'Últimos 7 días' },
    { v: '30', label: 'Últimos 30 días' },
    { v: '', label: 'Todo' },
  ]

  let q = $state('')
  let state = $state('')
  let source = $state('')
  let range = $state('7')
  let page = $state(1)
  let items = $state([])
  let total = $state(0)
  let error = $state('')
  let loading = $state(true)
  let selected = $state(null)
  let drawer = $state(false)
  let busy = $state(false)

  function buildFilter() {
    const parts = []
    const params = {}
    if (q.trim()) {
      parts.push('(phone ~ {:q} || text ~ {:q} || contact.name ~ {:q})')
      params.q = q.trim()
    }
    if (state) {
      parts.push('state = {:state}')
      params.state = state
    }
    if (source) {
      parts.push('source = {:source}')
      params.source = source
    }
    if (range) {
      parts.push('scheduled_at >= {:from}')
      params.from = new Date(Date.now() - Number(range) * 86400000).toISOString().replace('T', ' ')
    }
    return pb.filter(parts.join(' && ') || 'id != ""', params)
  }

  async function load() {
    try {
      const res = await pb.collection('messages').getList(page, PER_PAGE, {
        filter: buildFilter(),
        sort: '-scheduled_at',
        expand: 'contact,campaign',
      })
      items = res.items
      total = res.totalItems
      error = ''
      if (selected) selected = res.items.find((m) => m.id === selected.id) || selected
    } catch (err) {
      error = errMsg(err)
    } finally {
      loading = false
    }
  }

  // Cualquier filtro vuelve a la página 1; la página recarga la lista.
  let firstRun = true
  $effect(() => {
    q, state, source, range
    if (firstRun) return
    page = 1
  })
  $effect(() => {
    page, q, state, source, range
    load()
  })

  onMount(() => {
    firstRun = false
    const t = setInterval(() => page === 1 && load(), 8000)
    return () => clearInterval(t)
  })

  function open(m) {
    selected = m
    drawer = true
  }

  async function act(kind) {
    busy = true
    try {
      await pb.send(`/api/app/messages/${selected.id}/${kind}`, { method: 'POST' })
      toast(kind === 'retry' ? 'Reprogramado: saldrá en breve' : 'Mensaje cancelado')
      await load()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      busy = false
    }
  }

  async function exportCsv() {
    try {
      const all = await pb.collection('messages').getFullList({ filter: buildFilter(), sort: '-scheduled_at', expand: 'contact,campaign', batch: 1000 })
      downloadCsv('mensajes.csv', [
        ['Programado', 'Teléfono', 'Contacto', 'Mensaje', 'Origen', 'Campaña', 'Estado', 'Error'],
        ...all.map((m) => [
          m.scheduled_at, m.phone, m.expand?.contact?.name || '', m.text, SOURCE[m.source] || '',
          m.expand?.campaign?.name || '', STATE[m.state]?.label || m.state, m.error,
        ]),
      ])
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }
</script>

<PageHeader title="Mensajes" description="Todo lo que se ha enviado y programado, venga de la API, de campañas o de la web.">
  {#snippet actions()}
    <button class="btn btn-ghost btn-sm gap-1.5" onclick={exportCsv}><Icon name="download" size={15} /> Exportar CSV</button>
    <a href="/compose" class="btn btn-primary btn-sm gap-1.5"><Icon name="send" size={15} /> Nuevo mensaje</a>
  {/snippet}
</PageHeader>

<Alert message={error} />

<div class="mt-2 rounded-box border border-base-300 bg-base-100">
  <div class="flex flex-wrap items-center gap-2 border-b border-base-300 p-3">
    <label class="input input-sm flex min-w-52 flex-1 items-center gap-2">
      <Icon name="search" size={15} />
      <input type="search" class="grow" placeholder="Buscar por teléfono, nombre o texto" bind:value={q} aria-label="Buscar mensajes" />
    </label>
    <select class="select select-sm w-auto" bind:value={range} aria-label="Periodo">
      {#each ranges as r}<option value={r.v}>{r.label}</option>{/each}
    </select>
    <select class="select select-sm w-auto" bind:value={state} aria-label="Estado">
      <option value="">Todos los estados</option>
      {#each Object.entries(STATE) as [k, v]}<option value={k}>{v.label}</option>{/each}
    </select>
    <select class="select select-sm w-auto" bind:value={source} aria-label="Origen">
      <option value="">Todos los orígenes</option>
      {#each Object.entries(SOURCE) as [k, v]}<option value={k}>{v}</option>{/each}
    </select>
  </div>

  {#if loading}
    <div class="grid place-items-center py-16"><span class="loading loading-spinner"></span></div>
  {:else if items.length === 0}
    <EmptyState icon="inbox" title="Sin resultados" text="No hay mensajes con estos filtros." />
  {:else}
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr class="text-xs text-base-content/50">
            <th>Destinatario</th><th class="hidden md:table-cell">Mensaje</th><th class="hidden lg:table-cell">Origen</th><th>Estado</th><th class="text-right">Programado</th>
          </tr>
        </thead>
        <tbody>
          {#each items as m (m.id)}
            <tr class="cursor-pointer hover:bg-base-200/50" onclick={() => open(m)} tabindex="0" onkeydown={(e) => e.key === 'Enter' && open(m)}>
              <td>
                <div class="font-medium">{m.expand?.contact?.name || m.phone}</div>
                {#if m.expand?.contact?.name}<div class="text-xs text-base-content/50">{m.phone}</div>{/if}
                <div class="mt-0.5 max-w-44 truncate text-xs text-base-content/60 md:hidden">{m.text}</div>
              </td>
              <td class="hidden max-w-72 truncate text-base-content/70 md:table-cell">{m.text}</td>
              <td class="hidden text-base-content/70 lg:table-cell">
                {SOURCE[m.source] || '—'}
                {#if m.expand?.campaign}<div class="max-w-32 truncate text-xs text-base-content/50">{m.expand.campaign.name}</div>{/if}
              </td>
              <td>
                <StatusPill meta={STATE[m.state]} />
                {#if m.state === 'failed' && m.error}<div class="mt-0.5 max-w-40 truncate text-xs text-error/80" title={m.error}>{m.error}</div>{/if}
              </td>
              <td class="whitespace-nowrap text-right text-base-content/60">{fmtRelative(m.scheduled_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="border-t border-base-300 px-3">
      <Pagination bind:page perPage={PER_PAGE} {total} />
    </div>
  {/if}
</div>

<Drawer bind:open={drawer} title="Detalle del mensaje">
  {#if selected}
    <div class="grid gap-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">{selected.expand?.contact?.name || selected.phone}</p>
          {#if selected.expand?.contact?.name}<p class="text-sm text-base-content/50">{selected.phone}</p>{/if}
        </div>
        <StatusPill meta={STATE[selected.state]} />
      </div>

      <PhonePreview text={selected.text} to={selected.phone} />

      {#if selected.error}<Alert message={selected.error} />{/if}

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-base-content/50">Origen</dt>
        <dd>{SOURCE[selected.source] || '—'}{#if selected.expand?.campaign} · <a class="text-primary hover:underline" href="/campaigns/{selected.campaign}">{selected.expand.campaign.name}</a>{/if}</dd>
        <dt class="text-base-content/50">Programado</dt><dd>{fmtDate(selected.scheduled_at)}</dd>
        <dt class="text-base-content/50">Creado</dt><dd>{fmtDate(selected.created)}</dd>
        <dt class="text-base-content/50">Variante</dt><dd>{selected.variant || '—'}</dd>
        <dt class="text-base-content/50">Intentos</dt><dd>{selected.attempts || 0}</dd>
        <dt class="text-base-content/50">ID</dt><dd class="break-all font-mono text-xs">{selected.id}</dd>
      </dl>
    </div>
  {/if}
  {#snippet footer()}
    {#if selected?.state === 'failed'}
      <button class="btn btn-primary btn-sm gap-1.5" disabled={busy} onclick={() => act('retry')}><Icon name="refresh" size={15} /> Reintentar</button>
    {/if}
    {#if selected && (selected.state === 'pending' || selected.state === 'queued')}
      <button class="btn btn-error btn-outline btn-sm gap-1.5" disabled={busy} onclick={() => act('cancel')}><Icon name="ban" size={15} /> Cancelar envío</button>
    {/if}
  {/snippet}
</Drawer>
