/**
 * v-spotlight — cursor-tracking radial glow on cards.
 * Writes --mx / --my custom properties on the element; the card's CSS
 * uses them in a radial-gradient overlay. Client-only work happens in
 * mounted(); getSSRProps keeps the server renderer happy.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const ctx = nuxtApp.vueApp._context as { directives?: Record<string, unknown> }
  if (ctx.directives?.spotlight) return

  nuxtApp.vueApp.directive('spotlight', {
    getSSRProps() {
      return {}
    },
    mounted(el: HTMLElement) {
      el.classList.add('has-spotlight')

      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      const onEnter = () => el.style.setProperty('--spot-opacity', '1')
      const onLeave = () => el.style.setProperty('--spot-opacity', '0')

      el.addEventListener('mousemove', onMove)
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)

      // @ts-expect-error — stash for cleanup
      el._spotlight = { onMove, onEnter, onLeave }
    },
    unmounted(el: HTMLElement) {
      // @ts-expect-error — cleanup
      const h = el._spotlight
      if (!h) return
      el.removeEventListener('mousemove', h.onMove)
      el.removeEventListener('mouseenter', h.onEnter)
      el.removeEventListener('mouseleave', h.onLeave)
    },
  })
})
