<script>
  // values: arreglo de 5 textos (v1..v5). {nombre} se reemplaza por el primer nombre del contacto.
  import { smsInfo } from '#lib/format.js'

  // suffix: texto que se agrega al final de cada variante al enviar (p. ej. el pie de baja).
  let { values = $bindable(['', '', '', '', '']), suffix = '' } = $props()

  const filled = $derived(values.filter((v) => v.trim()).length)
</script>

<div role="group" aria-labelledby="variants-title" class="grid gap-3">
  <div class="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-sm">
    <span id="variants-title" class="font-medium">Variantes del mensaje</span>
    <span class="text-xs text-base-content/50">{filled}/5 · usa {'{nombre}'} para personalizar</span>
  </div>
  {#each values as _, i}
    {@const info = smsInfo(values[i] + (values[i] ? suffix : ''))}
    <div class="grid gap-1">
      <div class="flex items-center justify-between text-xs text-base-content/50">
        <label for="variant-{i}">Variante {i + 1}{i === 0 ? ' · obligatoria' : ''}</label>
        {#if values[i]}<span class="tabular-nums">{info.chars}/{info.limit} · {info.segments} SMS{suffix ? " (con pie)" : ""}</span>{/if}
      </div>
      <textarea id="variant-{i}" class="textarea h-16 w-full" maxlength="320" bind:value={values[i]} required={i === 0}></textarea>
    </div>
  {/each}
  <p class="text-xs text-base-content/50">Cada contacto recibe una variante; nunca se repite la misma en dos envíos seguidos.</p>
</div>
