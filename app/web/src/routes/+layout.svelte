<script>
  import '../app.css'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import pb from '#lib/pb.js'

  const { children } = $props()

  let authed = $state(pb.authStore.isValid)

  $effect(() => {
    const off = pb.authStore.onChange(() => {
      authed = pb.authStore.isValid
    })
    return off
  })

  $effect(() => {
    const onLogin = page.url.pathname === '/login'
    if (!authed && !onLogin) goto('/login')
    else if (authed && onLogin) goto('/')
  })

  const links = [
    { href: '/', label: 'Inicio' },
    { href: '/contacts', label: 'Contactos' },
    { href: '/templates', label: 'Plantillas' },
    { href: '/campaigns/new', label: 'Nueva campaña' },
    { href: '/api-docs', label: 'API' },
  ]

  function logout() {
    pb.authStore.clear()
  }
</script>

{#if authed}
  <header class="navbar bg-base-200 px-4 flex-wrap gap-2">
    <a href="/" class="text-lg font-semibold mr-4">Mensajes programados</a>
    <nav aria-label="Principal" class="flex-1">
      <ul class="menu menu-horizontal menu-sm gap-1 p-0">
        {#each links as l}
          <li>
            <a href={l.href} class:menu-active={page.url.pathname === l.href}>{l.label}</a>
          </li>
        {/each}
      </ul>
    </nav>
    <button class="btn btn-ghost btn-sm" onclick={logout}>Salir</button>
  </header>
  <main id="main-content" class="mx-auto max-w-5xl p-4 sm:p-6">
    {@render children()}
  </main>
{:else}
  <main id="main-content">
    {@render children()}
  </main>
{/if}
