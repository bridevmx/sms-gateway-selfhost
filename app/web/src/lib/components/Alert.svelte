<script>
  import Icon from '#lib/components/Icon.svelte'
  const { type = 'error', message = '' } = $props()
  const tone = {
    error: 'border-error/30 bg-error/5 text-error',
    success: 'border-success/30 bg-success/5 text-success',
    warning: 'border-warning/40 bg-warning/10 text-warning-content',
    info: 'border-info/30 bg-info/5 text-info',
  }
</script>

{#if message}
  <div role="alert" class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm {tone[type] || tone.error}">
    <Icon name={type === 'success' ? 'check' : 'alert'} size={16} class="mt-0.5 shrink-0" />
    <span>{message}</span>
  </div>
{/if}
