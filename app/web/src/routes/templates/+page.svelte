<script>
  import { onMount } from 'svelte'
  import pb from '#lib/pb.js'
  import Badge from '#lib/components/Badge.svelte'
  import Alert from '#lib/components/Alert.svelte'
  import VariantsEditor from '#lib/components/VariantsEditor.svelte'
  import { errMsg } from '#lib/format.js'

  let templates = $state([])
  let error = $state('')
  let editingId = $state('')
  let name = $state('')
  let slug = $state('')
  let variants = $state(['', '', '', '', ''])
  let active = $state(true)

  async function load() {
    try {
      templates = await pb.collection('templates').getFullList({ sort: 'name' })
    } catch (err) {
      error = errMsg(err)
    }
  }
  onMount(load)

  function reset() {
    editingId = ''
    name = slug = ''
    variants = ['', '', '', '', '']
    active = true
  }

  function edit(t) {
    editingId = t.id
    name = t.name
    slug = t.slug
    variants = [t.v1, t.v2, t.v3, t.v4, t.v5].map((v) => v || '')
    active = t.active
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(ev) {
    ev.preventDefault()
    error = ''
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
      reset()
      await load()
    } catch (err) {
      error = err?.response?.data?.slug ? 'El identificador es inválido o ya existe (a-z, 0-9, - y _)' : errMsg(err)
    }
  }

  async function remove(t) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return
    try {
      await pb.collection('templates').delete(t.id)
      await load()
    } catch (err) {
      error = errMsg(err)
    }
  }

  const count = (t) => [t.v1, t.v2, t.v3, t.v4, t.v5].filter(Boolean).length
</script>

<h1 class="text-2xl font-semibold mb-1">Plantillas</h1>
<p class="text-sm opacity-70 mb-4">Se usan desde la API con <code>"template": "identificador"</code>. Cada envío elige una variante distinta.</p>
<Alert message={error} />

<form class="card bg-base-200 p-4 gap-3 my-4" onsubmit={save} aria-labelledby="tpl-title">
  <h2 id="tpl-title" class="font-semibold">{editingId ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
  <div class="grid gap-3 sm:grid-cols-2">
    <input class="input input-bordered w-full" placeholder="Nombre" bind:value={name} aria-label="Nombre" required />
    <input class="input input-bordered w-full" placeholder="identificador (ej. recordatorio)" bind:value={slug} aria-label="Identificador" pattern="[a-z0-9_\-]+" required />
  </div>
  <VariantsEditor bind:values={variants} />
  <label class="label cursor-pointer justify-start gap-2">
    <input type="checkbox" class="checkbox checkbox-sm" bind:checked={active} />
    <span class="label-text">Activa</span>
  </label>
  <div class="flex gap-2">
    <button class="btn btn-primary btn-sm">{editingId ? 'Guardar' : 'Crear'}</button>
    {#if editingId}<button type="button" class="btn btn-ghost btn-sm" onclick={reset}>Cancelar</button>{/if}
  </div>
</form>

<div class="overflow-x-auto">
  <table class="table table-sm">
    <thead><tr><th>Nombre</th><th>Identificador</th><th>Variantes</th><th>Estado</th><th></th></tr></thead>
    <tbody>
      {#each templates as t (t.id)}
        <tr>
          <td>{t.name}</td>
          <td><code>{t.slug}</code></td>
          <td>{count(t)}</td>
          <td><Badge label={t.active ? 'Activa' : 'Inactiva'} cls={t.active ? 'badge-success' : 'badge-ghost'} /></td>
          <td class="text-right whitespace-nowrap">
            <button class="btn btn-ghost btn-xs" onclick={() => edit(t)}>Editar</button>
            <button class="btn btn-ghost btn-xs text-error" onclick={() => remove(t)}>Eliminar</button>
          </td>
        </tr>
      {:else}
        <tr><td colspan="5" class="opacity-70">Sin plantillas.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
