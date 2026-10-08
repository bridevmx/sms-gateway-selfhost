<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import StatusPill from '#lib/components/StatusPill.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import { CAMPAIGN, fmtDate, errMsg } from '#lib/format.js'

  let campaigns = $state([])
  let counts = $state({})
  let error = $state('')
  let loaded = $state(false)

  async function load() {
    try {
      const [camps, msgs] = await Promise.all([
        pb.collection('campaigns').getFullList({ sort: '-created' }),
        pb.collection('messages').getFullList({ filter: "source = 'campaign'", fields: 'campaign,state', batch: 1000 }),
      ])
      const c = {}
      for (const m of msgs) {
        c[m.campaign] ??= { total: 0 }
        c[m.campaign].total++
        c[m.campaign][m.state] = (c[m.campaign][m.state] || 0) + 1
      }
      campaigns = camps
      counts = c
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

  const done = (id) => (counts[id]?.delivered || 0) + (counts[id]?.sent || 0)
  const pct = (id) => (counts[id]?.total ? Math.round((done(id) / counts[id].total) * 100) : 0)
</script>

<PageHeader title="Campañas" description="Envíos a varios contactos con variantes de mensaje, pausas aleatorias, horario y tope diario.">
  {#snippet actions()}
    <a href="/campaigns/new" class="btn btn-primary btn-sm gap-1.5"><Icon name="plus" size={15} /> Nueva campaña</a>
  {/snippet}
</PageHeader>

<Alert message={error} />

<div class="mt-2 rounded-box border border-base-300 bg-base-100">
  {#if loaded && campaigns.length === 0}
    <EmptyState icon="megaphone" title="Aún no hay campañas" text="Crea una para enviar a varios contactos con variantes y pausas aleatorias.">
      {#snippet action()}<a href="/campaigns/new" class="btn btn-primary btn-sm">Nueva campaña</a>{/snippet}
    </EmptyState>
  {:else}
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr class="text-xs text-base-content/50"><th>Campaña</th><th>Estado</th><th>Inicio</th><th class="min-w-48">Avance</th><th></th></tr>
        </thead>
        <tbody>
          {#each campaigns as c (c.id)}
            <tr class="hover:bg-base-200/50">
              <td class="font-medium"><a href="/campaigns/{c.id}" class="hover:underline">{c.name}</a></td>
              <td><StatusPill meta={CAMPAIGN[c.status]} /></td>
              <td class="whitespace-nowrap text-base-content/70">{fmtDate(c.start_at)}</td>
              <td>
                {#if counts[c.id]}
                  <div class="flex items-center gap-2">
                    <progress class="progress progress-primary w-28" value={pct(c.id)} max="100"></progress>
                    <span class="text-xs tabular-nums text-base-content/60">{done(c.id)}/{counts[c.id].total}</span>
                    {#if counts[c.id].failed}<span class="text-xs text-error">{counts[c.id].failed} fallidos</span>{/if}
                  </div>
                {:else}<span class="text-base-content/40">—</span>{/if}
              </td>
              <td class="text-right"><a class="btn btn-ghost btn-xs" href="/campaigns/{c.id}">Abrir</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
