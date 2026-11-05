import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { 'virtual:rws-plates': fileURLToPath(new URL('./tests/plates-stub.ts', import.meta.url)) } },
})
