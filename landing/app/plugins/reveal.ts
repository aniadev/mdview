/**
 * v-reveal — scroll-reveal directive.
 * Universal plugin (not .client): the directive must be registered during SSR
 * so Vue's server renderer can resolve it (it calls dir.getSSRProps).
 * getSSRProps is a no-op; the IntersectionObserver only ever runs in mounted(),
 * which never fires on the server.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // Nuxt dev can load a plugin more than once — don't double-register.
  const ctx = nuxtApp.vueApp._context as { directives?: Record<string, unknown> }
  if (ctx.directives?.reveal) return
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps() {
      return {}
    },
    mounted(el: HTMLElement, binding) {
      el.classList.add('reveal')
      const delay = binding.value
      if (typeof delay === 'number' && delay > 0) {
        el.style.transitionDelay = `${delay}ms`
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              el.classList.add('in')
              io.unobserve(el)
            }
          })
        },
        { threshold: 0.12 },
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
