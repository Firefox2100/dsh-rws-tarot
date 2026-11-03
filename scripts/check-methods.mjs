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
walk(JSON.parse(readFileSync(join(root, 'packages/tarot-data/data/recurrence.json'), 'utf8')), 'recurrence')

// The book's four diagrams (HTML tables in the transcription) must say what `diagram` in methods.json says.
const part3 = readFileSync(join(textDir, readdirSync(textDir).find(f => f.startsWith('03-part-3'))), 'utf8')
const cellText = c => withoutTags(withoutComments(c)).replace(/\s+/g, ' ').trim()
const tables = [...part3.matchAll(/<table[\s\S]*?<\/table>/g)].map(t => [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(tr => [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(td => cellText(td[1])).filter(Boolean)))
const alternative = data.methods.find(m => m.id === 'alternative')
const continuation = data.methods.find(m => m.id === 'thirtyfive')
let diagrams = 0
const expect = (what, ok) => { diagrams++; if (!ok) { missing++; console.error(`diagram disagrees with the book: ${what}`) } }
const [dealt, regrouped, laid, packets] = tables
const ordinals = row => row.map(c => Number.parseInt(c, 10))
expect('four diagrams in Part III', tables.length === 4)
if (tables.length === 4) {
  const d = alternative.diagram
  const dealtRow = dealt.find(r => r.length > 0 && r.every(c => /packet$/.test(c)))
  expect('packets dealt', dealtRow.length === d.dealt.packets && ordinals(dealtRow).join() === [6, 5, 4, 3, 2, 1].join() && d.dealt.firstAt === 'right')
  const regroupedRow = regrouped.find(r => r.length > 0 && r.every(c => /packet$/.test(c)))
  expect('packets regrouped', regroupedRow.length === d.regrouped.packets && ordinals(regroupedRow).join() === [7, 6, 5, 4, 3, 2, 1].join() && d.regrouped.firstAt === 'right')
  const lines = laid.filter(r => r.length === 7 && r.every(c => /^\d$/.test(c)))
  expect('lines laid', lines.length === d.laid.lines && lines.every(r => r.join() === '7,6,5,4,3,2,1') && d.laid.numberedFrom === 'right')
  const sizeRow = packets.find(r => r.length > 0 && r.every(c => /cards$/.test(c)))
  expect('packets of the thirty-five', sizeRow.map(c => Number.parseInt(c, 10)).reverse().join() === continuation.diagram.packets.sizes.join() && continuation.diagram.packets.firstAt === 'right')
}
console.log(`${quotes} quotes and ${diagrams} diagram facts checked, ${missing} missing`)
process.exit(missing === 0 ? 0 : 1)
