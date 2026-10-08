<script>
  import Icon from '#lib/components/Icon.svelte'
  const { icon = 'inbox', title, text = '', action } = $props()
</script>

<div class="flex flex-col items-center gap-2 px-4 py-14 text-center">
  <span class="grid size-12 place-items-center rounded-full bg-base-200 text-base-content/50"><Icon name={icon} size={22} /></span>
  <p class="font-medium">{title}</p>
  {#if text}<p class="max-w-sm text-sm text-base-content/60">{text}</p>{/if}
  {#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
