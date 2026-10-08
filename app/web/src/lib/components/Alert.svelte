<script>
  const { type = 'error', message = '' } = $props()
</script>

{#if message}
  <div role="alert" class="alert alert-{type} alert-soft text-sm">
    <span>{message}</span>
  </div>
{/if}
