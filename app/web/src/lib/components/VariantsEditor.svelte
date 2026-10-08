<script>
  // values: arreglo de 5 textos (v1..v5). {nombre} se reemplaza por el primer nombre del contacto.
  import { smsInfo } from '#lib/format.js'

  let { values = $bindable(['', '', '', '', '']) } = $props()

  const filled = $derived(values.filter((v) => v.trim()).length)
</script>

<fieldset class="grid gap-3">
  <legend class="mb-1 flex w-full items-center justify-between text-sm">
    <span class="font-medium">Variantes del mensaje</span>
    <span class="text-xs text-base-content/50">{filled}/5 · usa {'{nombre}'} para personalizar</span>
  </legend>
  {#each values as _, i}
    {@const info = smsInfo(values[i])}
    <div class="grid gap-1">
      <div class="flex items-center justify-between text-xs text-base-content/50">
        <label for="variant-{i}">Variante {i + 1}{i === 0 ? ' · obligatoria' : ''}</label>
        {#if values[i]}<span class="tabular-nums">{info.chars}/{info.limit} · {info.segments} SMS</span>{/if}
      </div>
      <textarea id="variant-{i}" class="textarea h-16 w-full" maxlength="320" bind:value={values[i]} required={i === 0}></textarea>
    </div>
  {/each}
  <p class="text-xs text-base-content/50">Cada contacto recibe una variante; nunca se repite la misma en dos envíos seguidos.</p>
</fieldset>
