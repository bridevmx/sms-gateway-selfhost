<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import PhonePreview from '#lib/components/PhonePreview.svelte'
  import VariantsEditor from '#lib/components/VariantsEditor.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { initials, errMsg } from '#lib/format.js'

  let contacts = $state([])
  let limits = $state({ minDelayFloor: 20, maxPerDay: 150, maxCampaignSize: 500 })
  let selected = $state({})
  let search = $state('')
  let error = $state('')
  let busy = $state(false)

  let name = $state('')
  let variants = $state(['', '', '', '', ''])
  let optoutFooter = $state(true)
  let footerText = $state('Responde BAJA para salir')
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
      const [c, st] = await Promise.all([
        pb.collection('contacts').getFullList({ filter: 'consent = true && opted_out = false', sort: 'name' }),
        pb.send('/api/app/status', {}),
      ])
      contacts = c
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
  const hoursPerDay = $derived(Math.max(1, windowEnd - windowStart))
  const perDay = $derived(Math.min(Number(dailyLimit) || 1, limits.maxPerDay, Math.floor((hoursPerDay * 3600) / avg)))
  const days = $derived(Math.max(1, Math.ceil(chosen.length / perDay)))
  const footerSuffix = $derived(optoutFooter && footerText.trim() ? '\n' + footerText.trim() : '')
  const firstVariant = $derived((variants[0] || '').replace(/\{nombre\}/g, (contacts.find((c) => selected[c.id])?.name || '').split(/\s+/)[0]).trim())

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
    if (optoutFooter && !/BAJA|STOP|ALTO|CANCELAR/i.test(footerText)) return (error = 'El pie de baja debe incluir la palabra BAJA')
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
        footer_text: footerText.trim(),
      })
      const res = await pb.send(`/api/app/campaigns/${draft.id}/start`, { method: 'POST', body: { contactIds: chosen } })
      toast(`Campaña programada: ${res.created} mensajes`)
      goto(`/campaigns/${draft.id}`)
    } catch (err) {
      error = errMsg(err)
      if (draft) pb.collection('campaigns').delete(draft.id).catch(() => {})
      busy = false
    }
  }
</script>

<a href="/campaigns" class="mb-3 inline-flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content">
  <Icon name="chevronL" size={14} /> Campañas
</a>
<PageHeader title="Nueva campaña" description="Define el mensaje, el ritmo de envío y a quién va dirigido." />

<form class="grid gap-5 lg:grid-cols-[1fr_20rem]" onsubmit={submit} aria-label="Nueva campaña">
  <div class="grid content-start gap-5">
    <Alert message={error} />

    <section class="grid gap-4 rounded-box border border-base-300 bg-base-100 p-5" aria-labelledby="c1">
      <h2 id="c1" class="font-medium">Mensaje</h2>
      <label class="grid gap-1.5 text-sm">
        <span class="font-medium">Nombre de la campaña</span>
        <input class="input w-full" bind:value={name} placeholder="Ej. Recordatorio de citas" required />
      </label>
      <VariantsEditor bind:values={variants} suffix={footerSuffix} />
      <div class="grid gap-2">
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={optoutFooter} />
          Agregar pie de baja al final de cada mensaje
        </label>
        {#if optoutFooter}
          <label class="grid gap-1 text-sm">
            <span class="text-xs text-base-content/60">Texto del pie ({footerText.trim().length + 1} caracteres con el salto de línea; debe incluir BAJA)</span>
            <input class="input input-sm w-full max-w-md" bind:value={footerText} maxlength="80" aria-label="Texto del pie de baja" />
          </label>
        {/if}
      </div>
    </section>

    <section class="rounded-box border border-base-300 bg-base-100 p-5" aria-labelledby="c2">
      <h2 id="c2" class="mb-4 font-medium">Programación y ritmo</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm sm:col-span-2">
          <span class="font-medium">Inicio</span>
          <input type="datetime-local" class="input w-full max-w-xs" bind:value={startAt} required />
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="font-medium">Pausa mínima (s)</span>
          <input type="number" class="input w-full" min={limits.minDelayFloor} bind:value={minDelay} />
          <span class="text-xs text-base-content/50">Mínimo permitido: {limits.minDelayFloor} s</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="font-medium">Pausa máxima (s)</span>
          <input type="number" class="input w-full" min={minDelay} bind:value={maxDelay} />
          <span class="text-xs text-base-content/50">Cada pausa es aleatoria entre ambas</span>
        </label>
        <label class="grid gap-1.5 text-sm">
          <span class="font-medium">Máximo por día</span>
          <input type="number" class="input w-full" min="1" max={limits.maxPerDay} bind:value={dailyLimit} />
          <span class="text-xs text-base-content/50">Tope del servidor: {limits.maxPerDay}</span>
        </label>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <label class="grid gap-1.5"><span class="font-medium">Desde (hora)</span>
            <input type="number" class="input w-full" min="0" max="23" bind:value={windowStart} /></label>
          <label class="grid gap-1.5"><span class="font-medium">Hasta (hora)</span>
            <input type="number" class="input w-full" min="1" max="24" bind:value={windowEnd} /></label>
        </div>
      </div>
      <p class="mt-3 text-xs text-base-content/50">Solo se envía dentro del horario; lo que no alcance continúa al día siguiente.</p>
    </section>

    <section class="rounded-box border border-base-300 bg-base-100" aria-labelledby="c3">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 id="c3" class="font-medium">Destinatarios <span class="text-base-content/50">({chosen.length} seleccionados)</span></h2>
        <div class="flex gap-1">
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => toggleAll(true)}>Marcar visibles</button>
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => toggleAll(false)}>Quitar visibles</button>
        </div>
      </div>
      <div class="px-5 pt-3">
        <label class="input input-sm flex items-center gap-2">
          <Icon name="search" size={15} />
          <input type="search" class="grow" placeholder="Buscar contactos" bind:value={search} aria-label="Buscar contactos" />
        </label>
      </div>
      <ul class="mt-3 max-h-72 divide-y divide-base-200 overflow-y-auto border-t border-base-300">
        {#each visible as c (c.id)}
          <li>
            <label class="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-base-200/60">
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={selected[c.id]} />
              <span class="grid size-8 place-items-center rounded-full bg-base-200 text-xs font-medium text-base-content/70">{initials(c.name)}</span>
              <span class="flex-1 text-sm font-medium">{c.name || 'Sin nombre'}</span>
              <span class="text-sm text-base-content/50">{c.phone}</span>
            </label>
          </li>
        {:else}
          <li class="p-5 text-sm text-base-content/60">No hay contactos con consentimiento. <a class="text-primary hover:underline" href="/contacts">Agrégalos en Contactos</a>.</li>
        {/each}
      </ul>
    </section>
  </div>

  <aside class="lg:sticky lg:top-6 lg:self-start" aria-label="Resumen de la campaña">
    <div class="rounded-box border border-base-300 bg-base-100 p-5">
      <h2 class="mb-4 font-medium">Resumen</h2>
      <PhonePreview text={firstVariant} note="Escribe la variante 1 para ver la vista previa" />
      <dl class="mt-5 grid gap-2 text-sm">
        <div class="flex justify-between"><dt class="text-base-content/60">Destinatarios</dt><dd class="font-medium tabular-nums">{chosen.length}</dd></div>
        <div class="flex justify-between"><dt class="text-base-content/60">Pausa</dt><dd class="font-medium tabular-nums">{Math.max(minDelay, limits.minDelayFloor)}–{Math.max(maxDelay, minDelay)} s</dd></div>
        <div class="flex justify-between"><dt class="text-base-content/60">Por día (aprox.)</dt><dd class="font-medium tabular-nums">{perDay}</dd></div>
        <div class="flex justify-between"><dt class="text-base-content/60">Duración aprox.</dt><dd class="font-medium">{chosen.length ? `${days} día${days === 1 ? '' : 's'}` : '—'}</dd></div>
      </dl>
      <button class="btn btn-primary mt-5 w-full gap-2" disabled={busy || chosen.length === 0}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{:else}<Icon name="calendar" size={16} />{/if}
        Programar campaña
      </button>
    </div>
  </aside>
</form>
