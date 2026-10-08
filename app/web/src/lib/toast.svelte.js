export const toasts = $state([])

export function toast(message, type = 'success') {
  const id = Math.random()
  toasts.push({ id, message, type })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, 4500)
}
