import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { transform } from 'lightningcss'
import { defineConfig, type TsdownPlugin, type UserConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const ID = pkg.name

/** Packages the web shell already holds one instance of; the client bundle must not carry a second copy. */
const shared = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
])

function cssModules(): TsdownPlugin {
  const prefix = '\0css-module:'
  const suffix = '.mjs'
  return {
    name: 'css-modules',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      return prefix + resolve(dirname(importer), source) + suffix
    },
    async load(id: string) {
      if (!id.startsWith(prefix)) return null
      const file = id.slice(prefix.length, -suffix.length)
      this.addWatchFile(file)
      const { code, exports } = transform({ filename: file, code: await readFile(file), cssModules: { pattern: 'tarot_[hash]_[local]' }, minify: true })
      const classes = Object.fromEntries(Object.entries(exports ?? {}).map(([name, value]) => [name, value.name]))
      const key = `${ID}/${relative(process.cwd(), file)}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const key = ${JSON.stringify(key)};`,
        "let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(key) + ']');",
        "if (tag === null) { tag = document.createElement('style'); tag.dataset.pluginCss = key; document.head.appendChild(tag); }",
        'tag.textContent = css;',
        `export default ${JSON.stringify(classes)};`,
      ].join('\n')
    },
  }
}

const host: UserConfig = {
  name: `${ID}/host`,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  fixedExtension: false,
  deps: { neverBundle: specifier => specifier.startsWith('@deepseek-ai/') || specifier === 'zod' },
}

const client: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  fixedExtension: false,
  deps: { neverBundle: specifier => shared.has(specifier), alwaysBundle: specifier => !shared.has(specifier) },
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  plugins: [cssModules()],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapExcludeSources: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
}

export default defineConfig([host, client])
