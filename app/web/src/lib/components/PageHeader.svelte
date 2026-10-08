<script>
  const { title, description = '', actions } = $props()
</script>

<header class="mb-6 flex flex-wrap items-start justify-between gap-3">
  <div class="min-w-0">
    <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
    {#if description}<p class="mt-1 text-sm text-base-content/60 max-w-2xl">{description}</p>{/if}
  </div>
  {#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</header>
