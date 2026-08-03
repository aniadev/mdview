/**
 * Register the full lucide icon set offline, mirroring the app's main.ts
 * (`addCollection(lucideIcons)`). No CDN fetches — icons ship in the bundle.
 */
import { addCollection } from '@iconify/vue'
import lucideIcons from '@iconify-json/lucide/icons.json'

let registered = false

export default defineNuxtPlugin(() => {
  if (registered) return
  registered = true
  addCollection(lucideIcons)
})
