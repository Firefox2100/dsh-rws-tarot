import { readFile } from 'node:fs/promises'

const locales = ['zh', 'de', 'es', 'fr', 'ja', 'pt', 'ru']
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const ui = await read('packages/tarot/src/client/locales.json')
const words = await read('packages/tarot-engine/data/words.json')
const names = await read('packages/tarot-data/data/names.json')
const meanings = await read('packages/tarot-data/data/meanings.json')
const recurrenceMeanings = await read('packages/tarot-data/data/recurrence-meanings.json')
const cards = (await read('packages/tarot-data/data/cards.json')).cards
const recurrence = (await read('packages/tarot-data/data/recurrence.json')).entries

const failures = []
const fail = message => failures.push(message)
const wordCount = text => text.match(/\p{L}+/gu)?.length ?? 0

function leaves(value, path = '', output = new Map()) {
  if (typeof value === 'string') output.set(path, value)
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, `${path}/${index}`, output))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) leaves(item, path ? `${path}/${key}` : key, output)
  }
  return output
}

const placeholders = text => [...text.matchAll(/\{([A-Za-z]+)\}/g)]
  .map(match => match[1])
  .sort((left, right) => left.localeCompare(right))
  .join(',')

for (const [label, packs] of [['UI', ui], ['prompt', words]]) {
  const canonical = leaves(packs.en)
  for (const locale of locales) {
    const translated = leaves(packs[locale])
    for (const [path, text] of canonical) {
      if (!translated.has(path)) fail(`${label}/${locale}: missing ${path}`)
      else if (placeholders(translated.get(path)) !== placeholders(text)) fail(`${label}/${locale}/${path}: placeholders differ`)
      else if (text !== '' && translated.get(path) === text && wordCount(text) > 1
        && !['language', 'title', 'call.title', 'nine.cell', 'nineCell', 'separator'].includes(path)) {
        fail(`${label}/${locale}/${path}: unchanged from English`)
      }
    }
    for (const path of translated.keys()) if (!canonical.has(path)) fail(`${label}/${locale}: unexpected ${path}`)
  }
}

const recurrenceEnglish = new Map(recurrence.map(item => [`${item.rank}/${item.count}/${item.position}`, item.means]))
for (const locale of locales) {
  const table = recurrenceMeanings[locale]
  for (const [key, english] of recurrenceEnglish) {
    if (!table?.[key]) fail(`recurrence/${locale}: missing ${key}`)
    else if (table[key] === english && (['zh', 'ja', 'ru'].includes(locale) || wordCount(english) > 1)) {
      fail(`recurrence/${locale}/${key}: unchanged from English`)
    }
  }
  for (const key of Object.keys(table ?? {})) if (!recurrenceEnglish.has(key)) fail(`recurrence/${locale}: unexpected ${key}`)
}

for (const locale of locales) {
  if (!names[locale]) fail(`names: missing ${locale}`)
  for (const card of cards) {
    const translated = meanings[locale]?.[card.id]
    if (!translated) fail(`meanings/${locale}: missing ${card.id}`)
    else if (translated.length !== card.meanings.length) fail(`meanings/${locale}/${card.id}: expected ${card.meanings.length} entries`)
    else translated.forEach((text, index) => {
      if (!text.trim()) fail(`meanings/${locale}/${card.id}/${index}: empty`)
      if (text === card.meanings[index].text && (['zh', 'ja', 'ru'].includes(locale) || wordCount(text) > 1)) {
        fail(`meanings/${locale}/${card.id}/${index}: unchanged from English`)
      }
    })
  }
}

const translatedFiles = {
  names: JSON.stringify(names), meanings: JSON.stringify(meanings), recurrence: JSON.stringify(recurrenceMeanings),
}
const leakedTerms = [
  ['for instance', /for instance/i], ['Court Card', /Court Cards?/], ['Trumps', /\bTrumps\b/],
  ['precinct', /\bprecinct\b/i], ['consultar', /\bconsultar\b/i], ['thoughtful', /\bthoughtful\b/i],
  ['patrimony', /\bpatrimony\b/i], ['therein', /\btherein\b/i], ['qualified', /\bqualified\b/i],
]
for (const [file, text] of Object.entries(translatedFiles)) {
  for (const [term, pattern] of leakedTerms) if (pattern.test(text)) fail(`${file}: leaked term ${term}`)
}

for (const [locale, pattern] of [['zh', /[A-Za-z]{3,}/], ['ja', /[A-Za-z]{3,}/], ['ru', /[A-Za-z]{3,}/]]) {
  for (const [label, pack] of [['names', names[locale]], ['meanings', meanings[locale]], ['recurrence', recurrenceMeanings[locale]]]) {
    for (const [path, text] of leaves(pack)) {
      const stripped = text.replace(/\{(?:suit|rank)\}/g, '')
      if (pattern.test(stripped)) fail(`${label}/${locale}/${path}: contains Latin text`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Translations checked: ${locales.join(', ')}`)
}
