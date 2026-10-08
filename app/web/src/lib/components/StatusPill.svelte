<script>
  // meta: objeto de format.js (STATE[x] o CAMPAIGN[x])
  const { meta } = $props()
</script>

{#if meta}
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap {meta.soft}">
    <span class="size-1.5 rounded-full {meta.dot}"></span>
    {meta.label}
  </span>
{/if}
