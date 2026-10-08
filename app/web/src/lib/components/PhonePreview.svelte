<script>
  import { smsInfo } from '#lib/format.js'
  const { text = '', to = 'Destinatario', note = '' } = $props()
  const info = $derived(smsInfo(text))
</script>

<div class="mx-auto w-full max-w-64 rounded-[1.75rem] border-4 border-base-content/80 bg-base-100 p-2.5">
  <div class="mb-2 flex items-center justify-between px-2 pt-1 text-[10px] text-base-content/50">
    <span>{to}</span>
    <span>SMS</span>
  </div>
  <div class="min-h-40 rounded-2xl bg-base-200 p-3">
    {#if text.trim()}
      <div class="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-content">
        {text}
      </div>
      <p class="mt-1 text-right text-[10px] text-base-content/40">{info.segments} SMS</p>
    {:else}
      <p class="pt-10 text-center text-xs text-base-content/40">{note || 'Aquí verás cómo se ve el mensaje'}</p>
    {/if}
  </div>
</div>
