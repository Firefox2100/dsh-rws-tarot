// Every quoted text in methods.json must appear in the book, whitespace- and markup-insensitive.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const textDir = join(root, 'references/pictorial-key/text')
const withoutComments = (text) => {
  let result = ''
  let from = 0
  for (let open = text.indexOf('<!--', from); open >= 0; open = text.indexOf('<!--', from)) {
    result += text.slice(from, open)
    const close = text.indexOf('-->', open + 4)
    if (close < 0) return result
    result += ' '
    from = close + 3
  }
  return result + text.slice(from)
}
const withoutTags = (text) => {
  let result = ''
  let from = 0
  for (let open = text.indexOf('<', from); open >= 0; open = text.indexOf('<', from)) {
    result += text.slice(from, open)
    const close = text.indexOf('>', open + 1)
    if (close < 0) return result + text.slice(open)
    from = close + 1
  }
  return result + text.slice(from)
}
const flat = s => withoutTags(withoutComments(s)).replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\*/g, '').replace(/-\s*\n\s*/g, '').replace(/\s+/g, ' ').trim()
const corpus = flat(readdirSync(textDir).filter(f => f.endsWith('.md')).map(f => readFileSync(join(textDir, f), 'utf8')).join('\n'))
const data = JSON.parse(readFileSync(join(root, 'packages/tarot-data/data/methods.json'), 'utf8'))

let missing = 0
let quotes = 0
function walk(node, path) {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`))
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'text' || key === 'meaning' || key === 'say') && typeof value === 'string') {
      quotes++
      if (!corpus.includes(flat(value))) { missing++; console.error(`not in the book: ${path}.${key}: ${value.slice(0, 80)}`) }
    } else if (key === 'place' && typeof value === 'string' && value.length > 40) {
      quotes++
      if (!corpus.includes(flat(value))) { missing++; console.error(`not in the book: ${path}.${key}: ${value.slice(0, 80)}`) }
    } else walk(value, `${path}.${key}`)
  }
}
walk(data, 'methods')
console.log(`${quotes} quotes checked, ${missing} missing`)
process.exit(missing === 0 ? 0 : 1)
