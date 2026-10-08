<script>
  import pb from '#lib/pb.js'
  import Alert from '#lib/components/Alert.svelte'
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

<div class="min-h-screen flex items-center justify-center p-4">
  <form class="card bg-base-200 w-full max-w-sm p-6 gap-4" onsubmit={submit} aria-labelledby="login-title">
    <h1 id="login-title" class="text-xl font-semibold">Mensajes programados</h1>
    <label class="form-control w-full">
      <span class="label-text mb-1">Correo</span>
      <input id="email" type="email" class="input input-bordered w-full" bind:value={email} autocomplete="username" required />
    </label>
    <label class="form-control w-full">
      <span class="label-text mb-1">Contraseña</span>
      <input id="password" type="password" class="input input-bordered w-full" bind:value={password} autocomplete="current-password" required />
    </label>
    <Alert message={error} />
    <button class="btn btn-primary" disabled={busy}>
      {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
      Entrar
    </button>
  </form>
</div>
