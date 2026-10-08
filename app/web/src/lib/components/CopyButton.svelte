<script>
  import Icon from '#lib/components/Icon.svelte'
  const { text, label = 'Copiar' } = $props()
  let done = $state(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      done = true
      setTimeout(() => (done = false), 1500)
    } catch {
      done = false
    }
  }
</script>

<button type="button" class="btn btn-ghost btn-xs gap-1" onclick={copy}>
  <Icon name={done ? 'check' : 'copy'} size={14} />
  {done ? 'Copiado' : label}
</button>
