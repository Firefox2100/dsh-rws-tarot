import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { defineConfig, Rolldown, type TsdownPlugin, type UserConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const ID = pkg.name

/** Packages the web shell already holds one instance of; the client bundle must not carry a second copy. */
const shared = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots',
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

const root = fileURLToPath(new URL('../..', import.meta.url))
const PLATES = 'virtual:rws-plates'
/** Placeholder the module text carries until the render turns it into the module loader's `require.asset` call. */
const ASSET_CALL = '__dshPackageAsset_5f8e2c1a9b7d'

/**
 * Publish the 78 plates the way the host's package-asset route expects: each file under `lib/assets/plates/` with the
 * first 12 hex digits of its SHA-1 before the extension, referenced as `plugins/<package>/assets/<path>`. The plates
 * stay in `references/`, so a file whose bytes differ from the card data's SHA-256 stops the build instead of shipping.
 */
function plates(): TsdownPlugin {
  const id = `\0${PLATES}`
  return {
    name: 'rws-plates',
    resolveId: source => source === PLATES ? id : null,
    async load(source: string) {
      if (source !== id) return null
      const { cards } = JSON.parse(await readFile(resolve(root, 'packages/tarot-data/data/cards.json'), 'utf8')) as {
        cards: { id: string, image: { file: string, sha256: string } }[]
      }
      const entries: string[] = []
      for (const card of cards) {
        const file = resolve(root, card.image.file)
        const bytes = await readFile(file)
        if (createHash('sha256').update(bytes).digest('hex') !== card.image.sha256) throw new Error(`${card.id}: ${card.image.file} does not match its recorded SHA-256`)
        const name = basename(file)
        const dot = name.lastIndexOf('.')
        const emitted = `plates/${name.slice(0, dot)}-${createHash('sha1').update(bytes).digest('hex').slice(0, 12)}${name.slice(dot)}`
        this.emitFile({ type: 'asset', fileName: `assets/${emitted}`, source: bytes, originalFileName: file })
        this.addWatchFile(file)
        const url = `plugins/${ID}/assets/${emitted.split('/').map(encodeURIComponent).join('/')}`
        entries.push(`${JSON.stringify(name)}: ${ASSET_CALL}(${JSON.stringify(url)})`)
      }
      return `export default { ${entries.join(', ')} };`
    },
    renderChunk(code: string) {
      if (!code.includes(ASSET_CALL)) return null
      const rendered = new Rolldown.RolldownMagicString(code)
      for (const match of code.matchAll(new RegExp(`\\b${ASSET_CALL}\\(`, 'gu'))) rendered.overwrite(match.index, match.index + match[0].length, 'require.asset(')
      return rendered
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
  plugins: [cssModules(), plates()],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapExcludeSources: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
}

export default defineConfig([host, client])
