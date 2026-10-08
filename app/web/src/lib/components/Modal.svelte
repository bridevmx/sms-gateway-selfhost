<script>
  import Icon from '#lib/components/Icon.svelte'

  let { open = $bindable(false), title, children, footer, wide = false } = $props()
  let dlg

  $effect(() => {
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  })
</script>

<dialog bind:this={dlg} class="modal" onclose={() => (open = false)} aria-label={title}>
  <div class="modal-box p-0 {wide ? 'max-w-2xl' : 'max-w-md'}">
    <div class="flex items-center justify-between border-b border-base-300 px-5 py-3.5">
      <h2 class="font-semibold">{title}</h2>
      <button type="button" class="btn btn-ghost btn-sm btn-square" onclick={() => (open = false)} aria-label="Cerrar">
        <Icon name="x" size={16} />
      </button>
    </div>
    <div class="max-h-[70vh] overflow-y-auto px-5 py-4">{@render children()}</div>
    {#if footer}
      <div class="flex justify-end gap-2 border-t border-base-300 bg-base-200/50 px-5 py-3">{@render footer()}</div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
</dialog>
