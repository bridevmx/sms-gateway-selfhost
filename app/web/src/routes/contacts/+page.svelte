<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Badge from '#lib/components/Badge.svelte'
  import Alert from '#lib/components/Alert.svelte'
  import { normalizePhone } from '#lib/phone.js'
  import { errMsg } from '#lib/format.js'

  let contacts = $state([])
  let search = $state('')
  let error = $state('')
  let info = $state('')

  let name = $state('')
  let phone = $state('')
  let consent = $state(false)

  let bulk = $state('')
  let bulkConsent = $state(false)
  let importing = $state(false)

  async function load() {
    try {
      contacts = await pb.collection('contacts').getFullList({ sort: 'name' })
    } catch (err) {
      error = errMsg(err)
    }
  }
  onMount(load)

  const visible = $derived(
    contacts.filter((c) => {
      const q = search.trim().toLowerCase()
      return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    }),
  )

  async function add(ev) {
    ev.preventDefault()
    error = info = ''
    const p = normalizePhone(phone)
    if (!p) return (error = 'Teléfono inválido')
    try {
      await pb.collection('contacts').create({ name: name.trim(), phone: p, consent, opted_out: false })
      name = phone = ''
      consent = false
      await load()
    } catch (err) {
      error = err?.response?.data?.phone ? 'Ese teléfono ya existe' : errMsg(err)
    }
  }

  async function importBulk(ev) {
    ev.preventDefault()
    error = info = ''
    if (!bulkConsent) return (error = 'Confirma que los contactos aceptaron recibir mensajes')
    importing = true
    let ok = 0
    let dup = 0
    let bad = 0
    for (const line of bulk.split('\n')) {
      const row = line.trim()
      if (!row) continue
      const parts = row.split(/[,;\t]/).map((s) => s.trim())
      const [n, raw] = parts.length > 1 ? [parts[0], parts[1]] : ['', parts[0]]
      const p = normalizePhone(raw)
      if (!p) {
        bad++
        continue
      }
      try {
        await pb.collection('contacts').create({ name: n, phone: p, consent: true, opted_out: false })
        ok++
      } catch {
        dup++
      }
    }
    info = `Importados: ${ok} · duplicados: ${dup} · inválidos: ${bad}`
    bulk = ''
    importing = false
    await load()
  }

  async function toggleConsent(c) {
    try {
      await pb.collection('contacts').update(c.id, { consent: !c.consent })
      c.consent = !c.consent
    } catch (err) {
      error = errMsg(err)
    }
  }

  async function remove(c) {
    if (!confirm(`¿Eliminar a ${c.name || c.phone}?`)) return
    try {
      await pb.collection('contacts').delete(c.id)
      contacts = contacts.filter((x) => x.id !== c.id)
    } catch (err) {
      error = errMsg(err)
    }
  }

  const bulkPlaceholder = 'Una línea por contacto:\nAna Pérez, 7731234567'
</script>

<h1 class="text-2xl font-semibold mb-4">Contactos</h1>
<Alert message={error} />
<Alert type="success" message={info} />

<div class="grid gap-4 md:grid-cols-2 my-4">
  <form class="card bg-base-200 p-4 gap-3" onsubmit={add} aria-labelledby="add-title">
    <h2 id="add-title" class="font-semibold">Agregar contacto</h2>
    <input class="input input-bordered w-full" placeholder="Nombre" bind:value={name} aria-label="Nombre" />
    <input class="input input-bordered w-full" placeholder="Teléfono (10 dígitos o +código)" bind:value={phone} aria-label="Teléfono" required />
    <label class="label cursor-pointer justify-start gap-2">
      <input type="checkbox" class="checkbox checkbox-sm" bind:checked={consent} />
      <span class="label-text">Aceptó recibir mensajes</span>
    </label>
    <button class="btn btn-primary btn-sm self-start">Agregar</button>
  </form>

  <form class="card bg-base-200 p-4 gap-3" onsubmit={importBulk} aria-labelledby="bulk-title">
    <h2 id="bulk-title" class="font-semibold">Importar lista</h2>
    <textarea class="textarea textarea-bordered w-full h-24" placeholder={bulkPlaceholder} bind:value={bulk} aria-label="Lista de contactos"></textarea>
    <label class="label cursor-pointer justify-start gap-2">
      <input type="checkbox" class="checkbox checkbox-sm" bind:checked={bulkConsent} />
      <span class="label-text">Confirmo que todos aceptaron recibir mensajes</span>
    </label>
    <button class="btn btn-primary btn-sm self-start" disabled={importing || !bulk.trim()}>Importar</button>
  </form>
</div>

<input class="input input-bordered input-sm w-full max-w-xs mb-2" placeholder="Buscar…" bind:value={search} aria-label="Buscar contactos" />
<div class="overflow-x-auto">
  <table class="table table-sm">
    <thead><tr><th>Nombre</th><th>Teléfono</th><th>Consentimiento</th><th></th></tr></thead>
    <tbody>
      {#each visible as c (c.id)}
        <tr>
          <td>{c.name || '—'}</td>
          <td>{c.phone}</td>
          <td>
            {#if c.opted_out}
              <Badge label="Se dio de baja" cls="badge-error" />
            {:else}
              <input type="checkbox" class="toggle toggle-sm toggle-success" checked={c.consent} onchange={() => toggleConsent(c)} aria-label="Consentimiento de {c.name || c.phone}" />
            {/if}
          </td>
          <td class="text-right"><button class="btn btn-ghost btn-xs text-error" onclick={() => remove(c)}>Eliminar</button></td>
        </tr>
      {:else}
        <tr><td colspan="4" class="opacity-70">Sin contactos.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
<p class="text-xs opacity-60 mt-2">{contacts.length} contactos · solo reciben mensajes los que tienen consentimiento y no se dieron de baja.</p>
