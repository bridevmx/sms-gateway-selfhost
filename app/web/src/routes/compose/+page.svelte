<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import PhonePreview from '#lib/components/PhonePreview.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { normalizePhone } from '#lib/phone.js'
  import { smsInfo, fmtDate, errMsg } from '#lib/format.js'

  let contacts = $state([])
  let templates = $state([])
  let limits = $state(null)

  // Destinatarios
  let recipients = $state([]) // { phone, label }
  let typed = $state('')
  let search = $state('')
  let recipientError = $state('')

  // Mensaje
  let mode = $state('text') // text | template
  let text = $state('')
  let templateSlug = $state('')
  let vars = $state({})

  // Envío
  let when = $state('now') // now | later
  let sendAt = $state('')

  let error = $state('')
  let busy = $state(false)
  let confirmOpen = $state(false)

  onMount(async () => {
    try {
      const [c, t, st] = await Promise.all([
        pb.collection('contacts').getFullList({ filter: 'consent = true && opted_out = false', sort: 'name' }),
        pb.collection('templates').getFullList({ filter: 'active = true', sort: 'name' }),
        pb.send('/api/app/status', {}),
      ])
      contacts = c
      templates = t
      limits = st.limits
    } catch (err) {
      error = errMsg(err)
    }
  })

  // --- destinatarios ---
  function addPhones(raw) {
    recipientError = ''
    const bad = []
    for (const part of String(raw).split(/[\s,;]+/).filter(Boolean)) {
      const p = normalizePhone(part)
      if (!p) bad.push(part)
      else if (!recipients.some((r) => r.phone === p)) {
        const c = contacts.find((x) => x.phone === p)
        recipients.push({ phone: p, label: c?.name || '' })
      }
    }
    if (bad.length) recipientError = `Número inválido: ${bad.join(', ')}`
  }

  function onTypedKey(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      addPhones(typed)
      typed = ''
    } else if (e.key === 'Backspace' && !typed && recipients.length) {
      recipients.pop()
    }
  }

  function addContact(c) {
    if (!recipients.some((r) => r.phone === c.phone)) recipients.push({ phone: c.phone, label: c.name })
    search = ''
  }

  const suggestions = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return contacts
      .filter((c) => (c.name.toLowerCase().includes(q) || c.phone.includes(q)) && !recipients.some((r) => r.phone === c.phone))
      .slice(0, 6)
  })

  // --- mensaje ---
  const template = $derived(templates.find((t) => t.slug === templateSlug))
  const variants = $derived(template ? [template.v1, template.v2, template.v3, template.v4, template.v5].filter(Boolean) : [])
  const varNames = $derived([...new Set(variants.flatMap((v) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].filter((n) => n !== 'nombre'))
  const firstName = $derived((contacts.find((c) => c.phone === recipients[0]?.phone)?.name || '').split(/\s+/)[0] || '')

  const render = (tpl) =>
    tpl
      .replace(/\{(\w+)\}/g, (m, k) => (k === 'nombre' ? firstName : (vars[k] ?? '')))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()

  const previewText = $derived(mode === 'text' ? render(text) : variants[0] ? render(variants[0]) : '')
  const info = $derived(smsInfo(mode === 'text' ? text : previewText))

  // --- envío ---
  function preset(kind) {
    const d = new Date()
    if (kind === 'hour') d.setHours(d.getHours() + 1)
    else {
      d.setDate(d.getDate() + 1)
      d.setHours(kind === 'am' ? 9 : 18, 0, 0, 0)
    }
    const p = (n) => String(n).padStart(2, '0')
    sendAt = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    when = 'later'
  }

  const sendIso = $derived(sendAt && !isNaN(new Date(sendAt)) ? new Date(sendAt).toISOString() : '')
  const n = $derived(recipients.length)
  const avgDelay = $derived(limits ? (limits.apiMinDelay + limits.apiMaxDelay) / 2 : 40)
  const etaMin = $derived(Math.max(1, Math.round((n * avgDelay) / 60)))
  const canSend = $derived(
    n > 0 && (mode === 'text' ? text.trim().length > 0 : !!template) && (when === 'now' || !!sendAt) && !busy,
  )

  function review(ev) {
    ev.preventDefault()
    error = ''
    if (when === 'later' && (!sendIso || new Date(sendAt).getTime() < Date.now() + 60000)) {
      error = 'Elige una hora futura para programar el envío'
      return
    }
    confirmOpen = true
  }

  async function send() {
    busy = true
    error = ''
    try {
      const body = { phones: recipients.map((r) => r.phone) }
      if (mode === 'text') body.text = text.trim()
      else {
        body.template = templateSlug
        body.vars = vars
      }
      if (when === 'later') body.sendAt = sendIso
      const res = await pb.send('/api/app/send', { method: 'POST', body })
      const sk = res.skipped?.length ? ` · omitidos: ${res.skipped.length}` : ''
      toast(`${res.messages.length} mensaje(s) en cola${sk}`)
      goto('/messages')
    } catch (err) {
      error = errMsg(err)
      confirmOpen = false
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Nuevo mensaje" description="Envía un SMS a uno o varios números, con texto libre o una plantilla. Siempre sale con pausas aleatorias entre mensajes." />

<form onsubmit={review} class="grid gap-5 lg:grid-cols-[1fr_20rem]" aria-label="Nuevo mensaje">
  <div class="grid content-start gap-5">
    <Alert message={error} />

    <!-- 1. Destinatarios -->
    <section class="rounded-box border border-base-300 bg-base-100 p-5" aria-labelledby="to-title">
      <h2 id="to-title" class="mb-3 flex items-center gap-2 font-medium">
        <span class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-content">1</span> Destinatarios
      </h2>
      <div class="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-base-300 px-2 py-1.5 focus-within:border-primary">
        {#each recipients as r (r.phone)}
          <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-sm text-primary">
            {r.label ? `${r.label} · ` : ''}{r.phone}
            <button type="button" class="grid size-5 place-items-center rounded-full hover:bg-primary/20" aria-label="Quitar {r.phone}"
              onclick={() => (recipients = recipients.filter((x) => x.phone !== r.phone))}>
              <Icon name="x" size={12} />
            </button>
          </span>
        {/each}
        <input
          class="min-w-48 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          placeholder={recipients.length ? 'Agregar otro número…' : 'Escribe un número y pulsa Enter (10 dígitos o +código)'}
          bind:value={typed}
          onkeydown={onTypedKey}
          onblur={() => { if (typed.trim()) { addPhones(typed); typed = '' } }}
          onpaste={(e) => { e.preventDefault(); addPhones(e.clipboardData.getData('text')) }}
          aria-label="Número de teléfono"
        />
      </div>
      {#if recipientError}<p class="mt-1.5 text-xs text-error">{recipientError}</p>{/if}

      <div class="relative mt-3">
        <label class="input input-sm flex items-center gap-2">
          <Icon name="search" size={15} />
          <input type="search" class="grow" placeholder="O busca en tus contactos con consentimiento" bind:value={search} aria-label="Buscar contactos" />
        </label>
        {#if suggestions.length}
          <ul class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-lg">
            {#each suggestions as c (c.id)}
              <li>
                <button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-base-200" onclick={() => addContact(c)}>
                  <span class="font-medium">{c.name || 'Sin nombre'}</span><span class="text-base-content/50">{c.phone}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>

    <!-- 2. Mensaje -->
    <section class="rounded-box border border-base-300 bg-base-100 p-5" aria-labelledby="msg-title">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="msg-title" class="flex items-center gap-2 font-medium">
          <span class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-content">2</span> Mensaje
        </h2>
        <div role="tablist" class="tabs tabs-box tabs-sm">
          <button type="button" role="tab" class="tab {mode === 'text' ? 'tab-active' : ''}" onclick={() => (mode = 'text')}>Texto libre</button>
          <button type="button" role="tab" class="tab {mode === 'template' ? 'tab-active' : ''}" onclick={() => (mode = 'template')}>Plantilla</button>
        </div>
      </div>

      {#if mode === 'text'}
        <textarea class="textarea h-32 w-full" placeholder="Escribe tu mensaje…" bind:value={text} maxlength="640" aria-label="Texto del mensaje"></textarea>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/60">
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => (text += '{nombre}')}>Insertar {'{nombre}'}</button>
          <span class="tabular-nums">{info.chars} / {info.limit} · {info.segments} SMS</span>
        </div>
      {:else}
        <select class="select w-full" bind:value={templateSlug} aria-label="Plantilla">
          <option value="">Elige una plantilla…</option>
          {#each templates as t}<option value={t.slug}>{t.name}</option>{/each}
        </select>
        {#if templates.length === 0}
          <p class="mt-2 text-sm text-base-content/60">No tienes plantillas activas. <a class="text-primary hover:underline" href="/templates">Crear una</a></p>
        {/if}
        {#if template}
          <ul class="mt-3 grid gap-1.5 text-sm">
            {#each variants as v, i}
              <li class="rounded-lg bg-base-200 px-3 py-2"><span class="mr-1 text-xs text-base-content/40">V{i + 1}</span>{v}</li>
            {/each}
          </ul>
          <p class="mt-2 text-xs text-base-content/50">Cada destinatario recibe una de estas variantes, sin repetir la misma seguida.</p>
          {#if varNames.length}
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              {#each varNames as name}
                <label class="grid gap-1 text-sm">
                  <span class="text-base-content/60">{name}</span>
                  <input class="input input-sm w-full" bind:value={vars[name]} />
                </label>
              {/each}
            </div>
          {/if}
        {/if}
      {/if}

      {#if info.ucs2}
        <p class="mt-3 text-xs text-warning-content/90 rounded-lg bg-warning/15 px-3 py-2">
          Hay caracteres especiales ({info.offending.slice(0, 6).join(' ')}): el SMS usa codificación Unicode y caben solo 70 caracteres por segmento (los acentos á í ó ú cuentan así).
        </p>
      {/if}
    </section>

    <!-- 3. Envío -->
    <section class="rounded-box border border-base-300 bg-base-100 p-5" aria-labelledby="when-title">
      <h2 id="when-title" class="mb-3 flex items-center gap-2 font-medium">
        <span class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-content">3</span> Envío
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 {when === 'now' ? 'border-primary bg-primary/5' : 'border-base-300'}">
          <input type="radio" class="radio radio-primary radio-sm mt-0.5" name="when" value="now" bind:group={when} />
          <span><span class="block text-sm font-medium">Lo antes posible</span><span class="text-xs text-base-content/60">Entra a la cola y sale en segundos</span></span>
        </label>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 {when === 'later' ? 'border-primary bg-primary/5' : 'border-base-300'}">
          <input type="radio" class="radio radio-primary radio-sm mt-0.5" name="when" value="later" bind:group={when} />
          <span><span class="block text-sm font-medium">Programar</span><span class="text-xs text-base-content/60">Elige día y hora</span></span>
        </label>
      </div>
      {#if when === 'later'}
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" class="input input-sm" bind:value={sendAt} required aria-label="Fecha y hora de envío" />
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => preset('hour')}>En 1 hora</button>
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => preset('am')}>Mañana 9:00</button>
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => preset('pm')}>Mañana 18:00</button>
        </div>
      {/if}
    </section>
  </div>

  <!-- Resumen -->
  <aside class="lg:sticky lg:top-6 lg:self-start" aria-label="Resumen del envío">
    <div class="rounded-box border border-base-300 bg-base-100 p-5">
      <h2 class="mb-4 font-medium">Resumen</h2>
      <PhonePreview text={previewText} to={recipients[0]?.label || recipients[0]?.phone || 'Destinatario'} />
      <dl class="mt-5 grid gap-2 text-sm">
        <div class="flex justify-between"><dt class="text-base-content/60">Destinatarios</dt><dd class="font-medium tabular-nums">{n}</dd></div>
        <div class="flex justify-between"><dt class="text-base-content/60">SMS por mensaje</dt><dd class="font-medium tabular-nums">{info.segments || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-base-content/60">Salida</dt><dd class="font-medium">{when === 'now' ? 'En cola ahora' : sendIso ? fmtDate(sendIso) : '—'}</dd></div>
        {#if limits}
          <div class="flex justify-between"><dt class="text-base-content/60">Pausa entre envíos</dt><dd class="font-medium tabular-nums">{limits.apiMinDelay}–{limits.apiMaxDelay} s</dd></div>
          <div class="flex justify-between"><dt class="text-base-content/60">Horario</dt><dd class="font-medium tabular-nums">{limits.apiWindowStart}:00–{limits.apiWindowEnd}:00</dd></div>
        {/if}
        {#if n > 1}<div class="flex justify-between"><dt class="text-base-content/60">Duración aprox.</dt><dd class="font-medium">~{etaMin} min</dd></div>{/if}
      </dl>
      <button class="btn btn-primary mt-5 w-full gap-2" disabled={!canSend}>
        <Icon name={when === 'now' ? 'send' : 'calendar'} size={16} />
        {when === 'now' ? 'Revisar y enviar' : 'Revisar y programar'}
      </button>
      <p class="mt-3 flex items-start gap-1.5 text-xs text-base-content/50">
        <Icon name="shield" size={13} class="mt-0.5 shrink-0" /> Los números que respondieron BAJA se omiten automáticamente.
      </p>
    </div>
  </aside>
</form>

<Modal bind:open={confirmOpen} title="Confirmar envío">
  <p class="text-sm">
    Vas a {when === 'now' ? 'enviar' : 'programar'} <strong>{n}</strong> mensaje{n === 1 ? '' : 's'}
    {#if when === 'later' && sendIso}para el <strong>{fmtDate(sendIso)}</strong>{/if}
  </p>
  <div class="mt-3 rounded-lg bg-base-200 p-3 text-sm whitespace-pre-wrap">{previewText}</div>
  {#if n > 1}<p class="mt-3 text-xs text-base-content/60">Saldrán uno a uno, con pausas aleatorias. Tiempo aproximado: ~{etaMin} min.</p>{/if}
  {#snippet footer()}
    <button type="button" class="btn btn-ghost btn-sm" onclick={() => (confirmOpen = false)}>Volver</button>
    <button type="button" class="btn btn-primary btn-sm" disabled={busy} onclick={send}>
      {#if busy}<span class="loading loading-spinner loading-xs"></span>{/if}
      Confirmar
    </button>
  {/snippet}
</Modal>
