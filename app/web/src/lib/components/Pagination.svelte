<script>
  import Icon from '#lib/components/Icon.svelte'
  let { page = $bindable(1), perPage, total } = $props()
  const pages = $derived(Math.max(1, Math.ceil(total / perPage)))
  const from = $derived(total === 0 ? 0 : (page - 1) * perPage + 1)
  const to = $derived(Math.min(total, page * perPage))
</script>

<div class="flex items-center justify-between gap-3 px-1 py-3 text-sm text-base-content/60">
  <span>{from}–{to} de {total}</span>
  <div class="flex items-center gap-1">
    <button class="btn btn-ghost btn-sm btn-square" disabled={page <= 1} onclick={() => page--} aria-label="Anterior">
      <Icon name="chevronL" size={16} />
    </button>
    <span class="px-2 tabular-nums">{page} / {pages}</span>
    <button class="btn btn-ghost btn-sm btn-square" disabled={page >= pages} onclick={() => page++} aria-label="Siguiente">
      <Icon name="chevronR" size={16} />
    </button>
  </div>
</div>
