// Copy the 78 card plates into the plugin's build output, refusing any whose bytes differ from the data's recorded SHA-256.
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const { cards } = JSON.parse(readFileSync(join(root, 'packages/tarot-data/data/cards.json'), 'utf8'))
const out = join(root, 'packages/tarot/lib/plates')
mkdirSync(out, { recursive: true })
for (const card of cards) {
  const from = join(root, card.image.file)
  const sha256 = createHash('sha256').update(readFileSync(from)).digest('hex')
  if (sha256 !== card.image.sha256) throw new Error(`${card.id}: ${card.image.file} does not match its recorded SHA-256`)
  copyFileSync(from, join(out, basename(card.image.file)))
}
console.log(`copied ${cards.length} plates to ${out}`)
