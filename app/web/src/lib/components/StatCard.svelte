<script>
  import Icon from '#lib/components/Icon.svelte'
  const { label, value, hint = '', icon = '', tone = '' } = $props()
  const tones = {
    '': 'bg-base-200 text-base-content/60',
    success: 'bg-success/10 text-success',
    error: 'bg-error/10 text-error',
    info: 'bg-info/10 text-info',
    primary: 'bg-primary/10 text-primary',
  }
</script>

<div class="rounded-box border border-base-300 bg-base-100 p-4">
  <div class="flex items-center justify-between">
    <span class="text-sm text-base-content/60">{label}</span>
    {#if icon}
      <span class="grid size-8 place-items-center rounded-lg {tones[tone] || tones['']}"><Icon name={icon} size={16} /></span>
    {/if}
  </div>
  <div class="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
  {#if hint}<div class="mt-1 text-xs text-base-content/50">{hint}</div>{/if}
</div>
