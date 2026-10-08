<script>
  import { fade, fly } from 'svelte/transition'
  import Icon from '#lib/components/Icon.svelte'

  let { open = $bindable(false), title, children, footer } = $props()

  function onkey(e) {
    if (e.key === 'Escape') open = false
  }
</script>

<svelte:window onkeydown={onkey} />

{#if open}
  <div class="fixed inset-0 z-40">
    <button
      type="button"
      class="absolute inset-0 bg-black/40"
      aria-label="Cerrar panel"
      onclick={() => (open = false)}
      transition:fade={{ duration: 150 }}
    ></button>
    <aside
      class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-base-100 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      transition:fly={{ x: 420, duration: 200 }}
    >
      <div class="flex items-center justify-between border-b border-base-300 px-5 py-3.5">
        <h2 class="font-semibold">{title}</h2>
        <button type="button" class="btn btn-ghost btn-sm btn-square" onclick={() => (open = false)} aria-label="Cerrar">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-4">{@render children()}</div>
      {#if footer}
        <div class="flex flex-wrap justify-end gap-2 border-t border-base-300 px-5 py-3">{@render footer()}</div>
      {/if}
    </aside>
  </div>
{/if}
