<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import VariantsEditor from '#lib/components/VariantsEditor.svelte'
  import { errMsg } from '#lib/format.js'

  let contacts = $state([])
  let limits = $state({ minDelayFloor: 20, maxPerDay: 150, maxCampaignSize: 500 })
  let selected = $state({})
  let search = $state('')
  let error = $state('')
  let busy = $state(false)

  let name = $state('')
  let variants = $state(['', '', '', '', ''])
  let optoutFooter = $state(true)
  let minDelay = $state(60)
  let maxDelay = $state(120)
  let dailyLimit = $state(100)
  let windowStart = $state(9)
  let windowEnd = $state(20)

  function localInput(d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }
  let startAt = $state(localInput(new Date(Date.now() + 10 * 60000)))

  onMount(async () => {
    try {
      contacts = await pb.collection('contacts').getFullList({
        filter: 'consent = true && opted_out = false',
        sort: 'name',
      })
      const st = await pb.send('/api/app/status', {})
      if (st.limits) limits = st.limits
    } catch (err) {
      error = errMsg(err)
    }
  })

  const visible = $derived(
    contacts.filter((c) => {
      const q = search.trim().toLowerCase()
      return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    }),
  )
  const chosen = $derived(Object.keys(selected).filter((id) => selected[id]))
  const avg = $derived((Math.max(minDelay, limits.minDelayFloor) + Math.max(maxDelay, minDelay)) / 2)
  const estimateMin = $derived(Math.round((chosen.length * avg) / 60))

  function toggleAll(on) {
    const next = { ...selected }
    for (const c of visible) next[c.id] = on
    selected = next
  }

  async function submit(ev) {
    ev.preventDefault()
    error = ''
    if (!variants[0].trim()) return (error = 'Escribe al menos la variante 1')
    if (chosen.length === 0) return (error = 'Selecciona al menos un contacto')
    if (chosen.length > limits.maxCampaignSize) return (error = `Máximo ${limits.maxCampaignSize} contactos por campaña`)
    if (windowStart >= windowEnd) return (error = 'La hora de inicio debe ser menor que la de fin')
    busy = true
    let draft
    try {
      draft = await pb.collection('campaigns').create({
        name: name.trim(),
        v1: variants[0].trim(),
        v2: variants[1].trim(),
        v3: variants[2].trim(),
        v4: variants[3].trim(),
        v5: variants[4].trim(),
        status: 'draft',
        start_at: new Date(startAt).toISOString(),
        min_delay: Number(minDelay),
        max_delay: Number(maxDelay),
        daily_limit: Number(dailyLimit),
        window_start: Number(windowStart),
        window_end: Number(windowEnd),
        optout_footer: optoutFooter,
      })
      await pb.send(`/api/app/campaigns/${draft.id}/start`, { method: 'POST', body: { contactIds: chosen } })
      goto(`/campaigns/${draft.id}`)
    } catch (err) {
      error = errMsg(err)
      if (draft) pb.collection('campaigns').delete(draft.id).catch(() => {})
      busy = false
    }
  }
</script>

<h1 class="text-2xl font-semibold mb-4">Nueva campaña</h1>
<Alert message={error} />

<form class="grid gap-6 mt-4" onsubmit={submit} aria-label="Nueva campaña">
  <label class="form-control">
    <span class="label-text mb-1">Nombre</span>
    <input class="input input-bordered w-full" bind:value={name} required />
  </label>

  <VariantsEditor bind:values={variants} />

  <label class="label cursor-pointer justify-start gap-2">
    <input type="checkbox" class="checkbox checkbox-sm" bind:checked={optoutFooter} />
    <span class="label-text">Agregar al final "Responde BAJA para no recibir mas mensajes."</span>
  </label>

  <fieldset class="card bg-base-200 p-4 grid gap-3 sm:grid-cols-2">
    <legend class="font-semibold px-1">Programación y ritmo de envío</legend>
    <label class="form-control sm:col-span-2">
      <span class="label-text mb-1">Inicio</span>
      <input type="datetime-local" class="input input-bordered w-full max-w-xs" bind:value={startAt} required />
    </label>
    <label class="form-control">
      <span class="label-text mb-1">Pausa mínima entre mensajes (s)</span>
      <input type="number" class="input input-bordered w-full" min={limits.minDelayFloor} bind:value={minDelay} />
    </label>
    <label class="form-control">
      <span class="label-text mb-1">Pausa máxima (s)</span>
      <input type="number" class="input input-bordered w-full" min={minDelay} bind:value={maxDelay} />
    </label>
    <label class="form-control">
      <span class="label-text mb-1">Máximo por día (tope {limits.maxPerDay})</span>
      <input type="number" class="input input-bordered w-full" min="1" max={limits.maxPerDay} bind:value={dailyLimit} />
    </label>
    <div class="grid grid-cols-2 gap-2">
      <label class="form-control">
        <span class="label-text mb-1">Desde (hora)</span>
        <input type="number" class="input input-bordered w-full" min="0" max="23" bind:value={windowStart} />
      </label>
      <label class="form-control">
        <span class="label-text mb-1">Hasta (hora)</span>
        <input type="number" class="input input-bordered w-full" min="1" max="24" bind:value={windowEnd} />
      </label>
    </div>
    <p class="text-xs opacity-70 sm:col-span-2">
      Los envíos se reparten con pausas aleatorias, solo dentro del horario y sin pasar del máximo diario.
      Lo que sobre continúa al día siguiente.
    </p>
  </fieldset>

  <section aria-labelledby="who-title">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h2 id="who-title" class="font-semibold">Destinatarios ({chosen.length} seleccionados)</h2>
      <div class="flex gap-2">
        <button type="button" class="btn btn-ghost btn-xs" onclick={() => toggleAll(true)}>Marcar visibles</button>
        <button type="button" class="btn btn-ghost btn-xs" onclick={() => toggleAll(false)}>Quitar visibles</button>
      </div>
    </div>
    <input class="input input-bordered input-sm w-full max-w-xs mb-2" placeholder="Buscar…" bind:value={search} aria-label="Buscar contactos" />
    <div class="max-h-72 overflow-y-auto border border-base-300 rounded-box">
      {#each visible as c (c.id)}
        <label class="flex items-center gap-3 px-3 py-2 border-b border-base-200 cursor-pointer">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={selected[c.id]} />
          <span class="flex-1">{c.name || 'Sin nombre'}</span>
          <span class="text-sm opacity-70">{c.phone}</span>
        </label>
      {:else}
        <p class="p-3 text-sm opacity-70">No hay contactos con consentimiento. Agrégalos en Contactos.</p>
      {/each}
    </div>
    {#if chosen.length}
      <p class="text-xs opacity-70 mt-2">Duración estimada: ~{estimateMin} min de envío efectivo (sin contar pausas nocturnas).</p>
    {/if}
  </section>

  <button class="btn btn-primary self-start" disabled={busy}>
    {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
    Programar campaña
  </button>
</form>
