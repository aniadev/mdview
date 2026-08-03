/**
 * v-reveal — scroll-reveal directive.
 * Universal plugin (not .client): the directive must be registered during SSR
 * so Vue's server renderer can resolve it (it calls dir.getSSRProps).
 * getSSRProps is a no-op; the IntersectionObserver only ever runs in mounted(),
 * which never fires on the server.
 *
 * Usage:
 *   v-reveal                      → fade + rise
 *   v-reveal="120"                → same, delayed 120ms
 *   v-reveal="{ delay: 80, variant: 'scale' }"  → variants: scale | left | right
 */
type RevealOptions = number | { delay?: number; variant?: 'scale' | 'left' | 'right' } | undefined

export default defineNuxtPlugin((nuxtApp) => {
  const ctx = nuxtApp.vueApp._context as { directives?: Record<string, unknown> }
  if (ctx.directives?.reveal) return

  nuxtApp.vueApp.directive('reveal', {
    getSSRProps() {
      return {}
    },
    mounted(el: HTMLElement, binding: { value: RevealOptions }) {
      const opts = binding.value
      const delay = typeof opts === 'number' ? opts : (opts?.delay ?? 0)
      const variant = typeof opts === 'object' ? opts?.variant : undefined

      el.classList.add('reveal')
      if (variant) el.classList.add(`reveal-${variant}`)
      if (delay > 0) el.style.transitionDelay = `${delay}ms`

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              el.classList.add('in')
              io.unobserve(el)
              // drop will-change once the animation has run
              window.setTimeout(() => {
                el.style.willChange = 'auto'
              }, 900 + delay)
            }
          })
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
      )
      io.observe(el)
      // @ts-expect-error — store for cleanup
      el._revealIO = io
    },
    unmounted(el: HTMLElement) {
      // @ts-expect-error — cleanup
      el._revealIO?.disconnect()
    },
  })
})
