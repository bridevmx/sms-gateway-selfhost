<script>
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import { errMsg } from '#lib/format.js'

  let email = $state('')
  let password = $state('')
  let error = $state('')
  let busy = $state(false)

  async function submit(ev) {
    ev.preventDefault()
    busy = true
    error = ''
    try {
      await pb.collection('_superusers').authWithPassword(email, password)
    } catch (err) {
      error = err?.status === 400 ? 'Correo o contraseña incorrectos' : errMsg(err)
    } finally {
      busy = false
    }
  }
</script>

<div class="grid min-h-screen place-items-center bg-base-200/60 p-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 flex flex-col items-center gap-3 text-center">
      <span class="grid size-12 place-items-center rounded-xl bg-primary text-primary-content"><Icon name="send" size={22} /></span>
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Mensajes SMS</h1>
        <p class="text-sm text-base-content/60">Inicia sesión para continuar</p>
      </div>
    </div>
    <form class="grid gap-4 rounded-box border border-base-300 bg-base-100 p-6" onsubmit={submit} aria-label="Iniciar sesión">
      <label class="grid gap-1.5 text-sm">
        <span class="font-medium">Correo</span>
        <input id="email" type="email" class="input w-full" bind:value={email} autocomplete="username" required />
      </label>
      <label class="grid gap-1.5 text-sm">
        <span class="font-medium">Contraseña</span>
        <input id="password" type="password" class="input w-full" bind:value={password} autocomplete="current-password" required />
      </label>
      <Alert message={error} />
      <button class="btn btn-primary" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        Entrar
      </button>
    </form>
  </div>
</div>
