<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { normalizePhone } from '#lib/phone.js'
  import { initials, errMsg } from '#lib/format.js'

  let contacts = $state([])
  let search = $state('')
  let tab = $state('all') // all | consent | out
  let error = $state('')
  let loaded = $state(false)

  let addOpen = $state(false)
  let name = $state('')
  let phone = $state('')
  let consent = $state(false)
  let addError = $state('')

  let importOpen = $state(false)
  let bulk = $state('')
  let bulkConsent = $state(false)
  let importing = $state(false)
  let importError = $state('')

  let removing = $state(null)
  let removeOpen = $state(false)

  async function load() {
    try {
      contacts = await pb.collection('contacts').getFullList({ sort: 'name' })
    } catch (err) {
      error = errMsg(err)
    } finally {
      loaded = true
    }
  }
  onMount(load)

  const counts = $derived({
    all: contacts.length,
    consent: contacts.filter((c) => c.consent && !c.opted_out).length,
    out: contacts.filter((c) => c.opted_out).length,
  })

  const visible = $derived(
    contacts.filter((c) => {
      const q = search.trim().toLowerCase()
      const okQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
      const okTab = tab === 'all' || (tab === 'consent' ? c.consent && !c.opted_out : c.opted_out)
      return okQ && okTab
    }),
  )

  async function add(ev) {
    ev.preventDefault()
    addError = ''
    const p = normalizePhone(phone)
    if (!p) return (addError = 'Teléfono inválido')
    try {
      await pb.collection('contacts').create({ name: name.trim(), phone: p, consent, opted_out: false })
      name = phone = ''
      consent = false
      addOpen = false
      toast('Contacto agregado')
      await load()
    } catch (err) {
      addError = err?.response?.data?.phone ? 'Ese teléfono ya existe' : errMsg(err)
    }
  }

  async function importBulk(ev) {
    ev.preventDefault()
    importError = ''
    if (!bulkConsent) return (importError = 'Confirma que los contactos aceptaron recibir mensajes')
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
    bulk = ''
    importing = false
    importOpen = false
    toast(`Importados ${ok} · duplicados ${dup} · inválidos ${bad}`)
    await load()
  }

  async function toggleConsent(c) {
    try {
      await pb.collection('contacts').update(c.id, { consent: !c.consent })
      c.consent = !c.consent
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  async function remove() {
    const c = removing
    try {
      await pb.collection('contacts').delete(c.id)
      contacts = contacts.filter((x) => x.id !== c.id)
      toast('Contacto eliminado')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      removeOpen = false
    }
  }

  const bulkPlaceholder = 'Una línea por contacto:\nAna Pérez, 7731234567\n7739876543'
  const tabs = [
    { k: 'all', label: 'Todos' },
    { k: 'consent', label: 'Con consentimiento' },
    { k: 'out', label: 'Bajas' },
  ]
</script>

<PageHeader title="Contactos" description="Solo los contactos con consentimiento aparecen al crear campañas.">
  {#snippet actions()}
    <button class="btn btn-ghost btn-sm" onclick={() => (importOpen = true)}>Importar lista</button>
    <button class="btn btn-primary btn-sm gap-1.5" onclick={() => (addOpen = true)}><Icon name="plus" size={15} /> Agregar contacto</button>
  {/snippet}
</PageHeader>

<Alert message={error} />

<div class="mt-2 rounded-box border border-base-300 bg-base-100">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 p-3">
    <div role="tablist" class="tabs tabs-box tabs-sm">
      {#each tabs as t}
        <button role="tab" class="tab {tab === t.k ? 'tab-active' : ''}" onclick={() => (tab = t.k)}>
          {t.label} <span class="ml-1.5 text-base-content/50">{counts[t.k]}</span>
        </button>
      {/each}
    </div>
    <label class="input input-sm flex w-full max-w-64 items-center gap-2">
      <Icon name="search" size={15} />
      <input type="search" class="grow" placeholder="Buscar" bind:value={search} aria-label="Buscar contactos" />
    </label>
  </div>

  {#if loaded && visible.length === 0}
    <EmptyState icon="users" title={contacts.length ? 'Sin resultados' : 'Aún no hay contactos'}
      text={contacts.length ? 'Prueba con otra búsqueda o pestaña.' : 'Agrega uno a uno o importa una lista.'} />
  {:else}
    <div class="overflow-x-auto">
      <table class="table">
        <thead><tr class="text-xs text-base-content/50"><th>Contacto</th><th>Teléfono</th><th>Consentimiento</th><th></th></tr></thead>
        <tbody>
          {#each visible as c (c.id)}
            <tr class="hover:bg-base-200/50">
              <td>
                <div class="flex items-center gap-3">
                  <span class="grid size-8 place-items-center rounded-full bg-base-200 text-xs font-medium text-base-content/70">{initials(c.name)}</span>
                  <span class="font-medium">{c.name || 'Sin nombre'}</span>
                </div>
              </td>
              <td class="text-base-content/70">{c.phone}</td>
              <td>
                {#if c.opted_out}
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">
                    <span class="size-1.5 rounded-full bg-error"></span>Se dio de baja
                  </span>
                {:else}
                  <input type="checkbox" class="toggle toggle-sm toggle-success" checked={c.consent} onchange={() => toggleConsent(c)}
                    aria-label="Consentimiento de {c.name || c.phone}" />
                {/if}
              </td>
              <td class="text-right">
                <button class="btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-error" aria-label="Eliminar {c.name || c.phone}" onclick={() => { removing = c; removeOpen = true }}>
                  <Icon name="trash" size={15} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<Modal bind:open={addOpen} title="Agregar contacto">
  <form id="add-form" class="grid gap-4" onsubmit={add}>
    <label class="grid gap-1.5 text-sm"><span class="font-medium">Nombre</span>
      <input class="input w-full" bind:value={name} placeholder="Ana Pérez" /></label>
    <label class="grid gap-1.5 text-sm"><span class="font-medium">Teléfono</span>
      <input class="input w-full" bind:value={phone} placeholder="10 dígitos o +código de país" required /></label>
    <label class="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" class="checkbox checkbox-sm" bind:checked={consent} /> Aceptó recibir mensajes
    </label>
    <Alert message={addError} />
  </form>
  {#snippet footer()}
    <button type="button" class="btn btn-ghost btn-sm" onclick={() => (addOpen = false)}>Cancelar</button>
    <button type="submit" form="add-form" class="btn btn-primary btn-sm">Agregar</button>
  {/snippet}
</Modal>

<Modal bind:open={importOpen} title="Importar lista" wide>
  <form id="import-form" class="grid gap-4" onsubmit={importBulk}>
    <textarea class="textarea h-40 w-full font-mono text-xs" placeholder={bulkPlaceholder} bind:value={bulk} aria-label="Lista de contactos"></textarea>
    <label class="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" class="checkbox checkbox-sm" bind:checked={bulkConsent} /> Confirmo que todos aceptaron recibir mensajes
    </label>
    <Alert message={importError} />
  </form>
  {#snippet footer()}
    <button type="button" class="btn btn-ghost btn-sm" onclick={() => (importOpen = false)}>Cancelar</button>
    <button type="submit" form="import-form" class="btn btn-primary btn-sm" disabled={importing || !bulk.trim()}>
      {#if importing}<span class="loading loading-spinner loading-xs"></span>{/if}Importar
    </button>
  {/snippet}
</Modal>

<Modal bind:open={removeOpen} title="Eliminar contacto">
  <p class="text-sm">¿Eliminar a <strong>{removing?.name || removing?.phone}</strong>? Sus mensajes anteriores se conservan en el historial.</p>
  {#snippet footer()}
    <button class="btn btn-ghost btn-sm" onclick={() => (removeOpen = false)}>Cancelar</button>
    <button class="btn btn-error btn-sm" onclick={remove}>Eliminar</button>
  {/snippet}
</Modal>
