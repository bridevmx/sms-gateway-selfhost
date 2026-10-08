<script>
  // values: arreglo de 5 textos (v1..v5). {nombre} se reemplaza por el primer nombre del contacto.
  let { values = $bindable(['', '', '', '', '']) } = $props()

  const filled = $derived(values.filter((v) => v.trim()).length)
</script>

<fieldset class="grid gap-2">
  <legend class="label-text mb-1">
    Variantes del mensaje <span class="opacity-60">({filled}/5, usa {'{nombre}'} para personalizar)</span>
  </legend>
  {#each values as _, i}
    <label class="form-control">
      <span class="text-xs opacity-70">Variante {i + 1}{i === 0 ? ' (obligatoria)' : ''}</span>
      <textarea
        class="textarea textarea-bordered w-full h-16"
        maxlength="320"
        bind:value={values[i]}
        required={i === 0}
        aria-label="Variante {i + 1}"
      ></textarea>
    </label>
  {/each}
  <p class="text-xs opacity-60">Se reparte una variante distinta entre contactos consecutivos.</p>
</fieldset>
