<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import PageHeader from '#lib/components/PageHeader.svelte'
  import EmptyState from '#lib/components/EmptyState.svelte'
  import VariantsEditor from '#lib/components/VariantsEditor.svelte'
  import CopyButton from '#lib/components/CopyButton.svelte'
  import { toast } from '#lib/toast.svelte.js'
  import { errMsg } from '#lib/format.js'

  let templates = $state([])
  let error = $state('')
  let loaded = $state(false)

  let formOpen = $state(false)
  let formError = $state('')
  let editingId = $state('')
  let name = $state('')
  let slug = $state('')
  let variants = $state(['', '', '', '', ''])
  let active = $state(true)

  let removeOpen = $state(false)
  let removing = $state(null)

  async function load() {
    try {
      templates = await pb.collection('templates').getFullList({ sort: 'name' })
    } catch (err) {
      error = errMsg(err)
    } finally {
      loaded = true
    }
  }
  onMount(load)

  function openNew() {
    editingId = ''
    name = slug = formError = ''
    variants = ['', '', '', '', '']
    active = true
    formOpen = true
  }

  function openEdit(t) {
    editingId = t.id
    name = t.name
    slug = t.slug
    variants = [t.v1, t.v2, t.v3, t.v4, t.v5].map((v) => v || '')
    active = t.active
    formError = ''
    formOpen = true
  }

  async function save(ev) {
    ev.preventDefault()
    formError = ''
    const data = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      active,
      v1: variants[0].trim(),
      v2: variants[1].trim(),
      v3: variants[2].trim(),
      v4: variants[3].trim(),
      v5: variants[4].trim(),
    }
    try {
      if (editingId) await pb.collection('templates').update(editingId, data)
      else await pb.collection('templates').create(data)
      formOpen = false
      toast(editingId ? 'Plantilla guardada' : 'Plantilla creada')
      await load()
    } catch (err) {
      formError = err?.response?.data?.slug ? 'El identificador es inválido o ya existe (usa a-z, 0-9, - y _)' : errMsg(err)
    }
  }

  async function remove() {
    try {
      await pb.collection('templates').delete(removing.id)
      toast('Plantilla eliminada')
      await load()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      removeOpen = false
    }
  }

  const list = (t) => [t.v1, t.v2, t.v3, t.v4, t.v5].filter(Boolean)
</script>

<PageHeader title="Plantillas" description="Mensajes reutilizables con hasta 5 variantes. Se usan desde Nuevo mensaje y desde la API con su identificador.">
  {#snippet actions()}
    <button class="btn btn-primary btn-sm gap-1.5" onclick={openNew}><Icon name="plus" size={15} /> Nueva plantilla</button>
  {/snippet}
</PageHeader>

<Alert message={error} />

{#if loaded && templates.length === 0}
  <div class="mt-2 rounded-box border border-base-300 bg-base-100">
    <EmptyState icon="file" title="Aún no hay plantillas" text="Crea una con varias variantes para que los mensajes no salgan siempre iguales.">
      {#snippet action()}<button class="btn btn-primary btn-sm" onclick={openNew}>Nueva plantilla</button>{/snippet}
    </EmptyState>
  </div>
{:else}
  <div class="mt-2 grid gap-4 md:grid-cols-2">
    {#each templates as t (t.id)}
      <article class="flex flex-col rounded-box border border-base-300 bg-base-100 p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate font-medium">{t.name}</h2>
            <div class="mt-1 flex items-center gap-1 text-xs text-base-content/50">
              <code class="rounded bg-base-200 px-1.5 py-0.5">{t.slug}</code>
              <CopyButton text={t.slug} label="" />
            </div>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {t.active ? 'bg-success/10 text-success' : 'bg-base-200 text-base-content/60'}">
            <span class="size-1.5 rounded-full {t.active ? 'bg-success' : 'bg-base-content/40'}"></span>{t.active ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <ul class="mt-4 grid flex-1 content-start gap-1.5 text-sm">
          {#each list(t).slice(0, 3) as v, i}
            <li class="truncate rounded-lg bg-base-200 px-3 py-2"><span class="mr-1 text-xs text-base-content/40">V{i + 1}</span>{v}</li>
          {/each}
          {#if list(t).length > 3}<li class="px-1 text-xs text-base-content/50">+{list(t).length - 3} variantes más</li>{/if}
        </ul>
        <div class="mt-4 flex justify-end gap-1">
          <button class="btn btn-ghost btn-xs" onclick={() => openEdit(t)}>Editar</button>
          <button class="btn btn-ghost btn-xs text-error" onclick={() => { removing = t; removeOpen = true }}>Eliminar</button>
        </div>
      </article>
    {/each}
  </div>
{/if}

<Modal bind:open={formOpen} title={editingId ? 'Editar plantilla' : 'Nueva plantilla'} wide>
  <form id="tpl-form" class="grid gap-4" onsubmit={save}>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="grid gap-1.5 text-sm"><span class="font-medium">Nombre</span>
        <input class="input w-full" bind:value={name} placeholder="Recordatorio de cita" required /></label>
      <label class="grid gap-1.5 text-sm"><span class="font-medium">Identificador</span>
        <input class="input w-full" bind:value={slug} placeholder="recordatorio" pattern="[a-z0-9_\-]+" required /></label>
    </div>
    <VariantsEditor bind:values={variants} />
    <label class="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" class="checkbox checkbox-sm" bind:checked={active} /> Activa
    </label>
    <Alert message={formError} />
  </form>
  {#snippet footer()}
    <button type="button" class="btn btn-ghost btn-sm" onclick={() => (formOpen = false)}>Cancelar</button>
    <button type="submit" form="tpl-form" class="btn btn-primary btn-sm">{editingId ? 'Guardar' : 'Crear'}</button>
  {/snippet}
</Modal>

<Modal bind:open={removeOpen} title="Eliminar plantilla">
  <p class="text-sm">¿Eliminar <strong>{removing?.name}</strong>? Las integraciones que la usen dejarán de funcionar.</p>
  {#snippet footer()}
    <button class="btn btn-ghost btn-sm" onclick={() => (removeOpen = false)}>Cancelar</button>
    <button class="btn btn-error btn-sm" onclick={remove}>Eliminar</button>
  {/snippet}
</Modal>
