<script>
  import '../app.css'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import pb from '#lib/pb.js'
  import Icon from '#lib/components/Icon.svelte'
  import { toasts } from '#lib/toast.svelte.js'
  import { fmtRelative } from '#lib/format.js'

  const { children } = $props()

  let authed = $state(pb.authStore.isValid)
  let menuOpen = $state(false)
  let gw = $state(null)

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

  // Cierra el menú móvil al navegar.
  $effect(() => {
    page.url.pathname
    menuOpen = false
  })

  async function loadGateway() {
    if (!pb.authStore.isValid) return
    try {
      gw = await pb.send('/api/app/status', {})
    } catch {
      gw = { gatewayOk: false, devices: [] }
    }
  }

  onMount(() => {
    loadGateway()
    const t = setInterval(loadGateway, 30000)
    return () => clearInterval(t)
  })

  $effect(() => {
    if (authed) loadGateway()
  })

  const nav = [
    { items: [{ href: '/', label: 'Resumen', icon: 'home' }] },
    {
      title: 'Mensajería',
      items: [
        { href: '/compose', label: 'Nuevo mensaje', icon: 'send' },
        { href: '/messages', label: 'Mensajes', icon: 'inbox' },
        { href: '/campaigns', label: 'Campañas', icon: 'megaphone' },
      ],
    },
    {
      title: 'Audiencia',
      items: [
        { href: '/contacts', label: 'Contactos', icon: 'users' },
        { href: '/templates', label: 'Plantillas', icon: 'file' },
      ],
    },
    { title: 'Desarrolladores', items: [{ href: '/api-docs', label: 'API', icon: 'code' }] },
  ]

  const isActive = (href) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href))
  const device = $derived(gw?.devices?.[0])

  function logout() {
    pb.authStore.clear()
  }
</script>

{#snippet sidebar()}
  <div class="flex h-full flex-col">
    <a href="/" class="flex items-center gap-2.5 px-5 py-4">
      <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-content"><Icon name="send" size={16} /></span>
      <span class="font-semibold tracking-tight">Mensajes SMS</span>
    </a>

    <nav aria-label="Principal" class="flex-1 overflow-y-auto px-3 pb-4">
      {#each nav as group}
        <div class="mt-4 first:mt-1">
          {#if group.title}
            <p class="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-base-content/40">{group.title}</p>
          {/if}
          <ul class="grid gap-0.5">
            {#each group.items as l}
              <li>
                <a
                  href={l.href}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors
                    {isActive(l.href) ? 'bg-primary/10 font-medium text-primary' : 'text-base-content/70 hover:bg-base-200'}"
                >
                  <Icon name={l.icon} size={17} />
                  {l.label}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <div class="border-t border-base-300 p-3">
      <div class="mb-2 flex items-start gap-2.5 rounded-lg bg-base-200 px-3 py-2.5 text-xs">
        <span class="mt-1 size-2 shrink-0 rounded-full {gw ? (gw.gatewayOk ? 'bg-success' : 'bg-error') : 'bg-base-content/30'}"></span>
        <div class="min-w-0">
          <p class="font-medium">{gw ? (gw.gatewayOk ? 'Tablet conectada' : 'Sin conexión') : 'Comprobando…'}</p>
          {#if device}
            <p class="truncate text-base-content/50">{device.name || 'Dispositivo'} · {fmtRelative(device.lastSeen)}</p>
          {:else if gw?.error}
            <p class="text-base-content/50">{gw.error}</p>
          {/if}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/70" onclick={logout}>
        <Icon name="logout" size={16} /> Cerrar sesión
      </button>
    </div>
  </div>
{/snippet}

{#if authed}
  <div class="min-h-screen bg-base-200/60">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-base-300 bg-base-100 lg:block">
      {@render sidebar()}
    </aside>

    <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-base-300 bg-base-100 px-4 py-2.5 lg:hidden">
      <button class="btn btn-ghost btn-sm btn-square" onclick={() => (menuOpen = true)} aria-label="Abrir menú">
        <Icon name="menu" />
      </button>
      <span class="font-semibold">Mensajes SMS</span>
    </header>

    {#if menuOpen}
      <div class="fixed inset-0 z-40 lg:hidden">
        <button class="absolute inset-0 bg-black/40" aria-label="Cerrar menú" onclick={() => (menuOpen = false)} transition:fade={{ duration: 120 }}></button>
        <aside class="absolute inset-y-0 left-0 w-64 bg-base-100 shadow-xl">{@render sidebar()}</aside>
      </div>
    {/if}

    <main id="main-content" class="lg:pl-64">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {@render children()}
      </div>
    </main>
  </div>
{:else}
  <main id="main-content">
    {@render children()}
  </main>
{/if}

<div class="toast toast-end toast-bottom z-50" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="alert {t.type === 'error' ? 'alert-error' : 'alert-success'} py-2 text-sm shadow-lg" transition:fade={{ duration: 150 }}>
      <span>{t.message}</span>
    </div>
  {/each}
</div>
