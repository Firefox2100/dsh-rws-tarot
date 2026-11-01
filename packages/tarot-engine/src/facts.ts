import { cardName, finalCardText, followUpTexts, getCard, getMethod, pickLocale, positionMeaning, positionName, type Card } from '@dsh-rws-tarot/data'
import type { Placed } from './pack.ts'
import type { Reading } from './table.ts'

/**
 * The wording the model is given, one pack per language. Each tells the model what the reading is and how to sound,
 * never where the meanings come from: naming a source or reciting a text is what makes an answer mechanical. The
 * book's own sentences stay as written and are the same in every pack.
 */
interface Words {
  readonly style: readonly string[]
  readonly asks: (question: string) => string
  readonly significator: (name: string) => string
  readonly turned: (n: number, total: number, name: string) => string
  readonly position: (name: string, meaning: string) => string
  readonly meaning: string
  readonly also: string
  readonly noMeaning: (orientation: string) => string
  readonly table: string
  readonly last: string
  readonly forPosition: string
  readonly ifApplies: string
  readonly upright: string
  readonly reversed: string
  readonly reversedName: (name: string) => string
}

const en: Words = {
  style: [
    'You are reading tarot for the person asking. A spread is laid one card at a time, and each card they turn over is handed to you as it appears.',
    '',
    'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table. Say what the card means in the position where it fell and, once other cards are down, how it works with them, for example "The reversed Tower here suggests ... and against the Eight of Pentacles beneath it, ...".',
    'Use plain flowing prose: no headings, lists, bold or card numbers, and put the position in your own words (the influence around you, what stands in your way, and so on) instead of quoting its label. In the position names and the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
    'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph or two for each card is enough.',
  ],
  asks: q => `They ask: ${q}`,
  significator: name => `The card standing for them, or for the matter asked about, lies face up: ${name}.`,
  turned: (n, total, name) => `Card ${n} of ${total} has just been turned over: ${name}.`,
  position: (name, meaning) => `Its position is "${name}": ${meaning}`,
  meaning: 'Meaning',
  also: 'Also',
  noMeaning: o => `No ${o} meaning is given for this card; say nothing more than that it is ${o}, and do not make one up.`,
  table: 'Already on the table:',
  last: 'This is the last card. After speaking to it, bring the whole spread together into one closing reading that answers them.',
  forPosition: 'For this position',
  ifApplies: 'If it applies',
  upright: 'upright',
  reversed: 'reversed',
  reversedName: name => `${name}, reversed`,
}

const zh: Words = {
  style: [
    '你正在为提问的人占卜塔罗。牌阵一张一张地铺开，他们每翻开一张牌，这张牌就会交到你手里。',
    '',
    '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”。说清这张牌落在这个位置上意味着什么；等桌上有了别的牌，再说它们如何彼此呼应，例如“倒位的高塔落在这里，说明……，再对照下方的星币八，……”。',
    '用平实流畅的行文：不要标题、列表、粗体和牌的序号；位置请用你自己的话说出来（围绕你的影响、挡在你面前的事等），不要照搬位置名称。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
    '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每张牌写一两小段就够了。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
  ],
  asks: q => `他们问：${q}`,
  significator: name => `代表他们（或所问之事）的牌正面朝上：${name}。`,
  turned: (n, total, name) => `第 ${n} 张（共 ${total} 张）刚刚翻开：${name}。`,
  position: (name, meaning) => `它所在的位置是“${name}”：${meaning}`,
  meaning: '牌义',
  also: '补充',
  noMeaning: o => `这张牌在${o}时没有给出牌义；只需说明它是${o}，不要自己编造。`,
  table: '桌上已有的牌：',
  last: '这是最后一张牌。说完这张之后，把整个牌阵合起来，给出一个回答他们问题的总结。',
  forPosition: '关于这个位置',
  ifApplies: '如果适用',
  upright: '正位',
  reversed: '逆位',
  reversedName: name => `${name}（逆位）`,
}

const WORDS: Readonly<Record<string, Words>> = { en, zh }

function meaningLines(card: Card, placed: Placed, indent: string, words: Words): string[] {
  const scenario = placed.reversed ? 'reversed' : 'upright'
  const lines: string[] = []
  const divinatory = card.meanings.filter(m => m.scenario === scenario && m.context === 'divinatory')
  for (const m of divinatory) lines.push(`${indent}${words.meaning}: ${m.text}`)
  if (divinatory.length === 0) lines.push(`${indent}${words.noMeaning(words[scenario])}`)
  for (const m of card.meanings.filter(m => m.scenario === scenario && m.context === 'additional')) lines.push(`${indent}${words.also}: ${m.text}`)
  return lines
}

/**
 * What to put in front of the model when a card is turned up: the card, the position it fell in, the cards already on
 * the table, and the meanings to draw on. Nothing here is an interpretation. The reading's language is that of the
 * person's screen; the names and the wording follow it, and the model's own language follows from them.
 */
export function describeCard(reading: Reading, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const method = getMethod(reading.method)
  const position = method.positions[index]
  const placed = reading.order[index]
  if (position === undefined || placed === undefined || index >= reading.drawn) throw new RangeError(`describeCard: card ${index + 1} has not been turned up`)
  const turned = reading.order.slice(0, index)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const where = (i: number): string => positionName(method.id, method.positions[i]!, locale)
  const lines: string[] = []

  if (index === 0) {
    lines.push(...words.style, '')
    if (reading.question.trim() !== '') lines.push(words.asks(reading.question.trim()), '')
    if (reading.significator !== null) {
      lines.push(words.significator(named(reading.significator)), ...meaningLines(getCard(reading.significator.cardId), reading.significator, '  ', words), '')
    }
  }

  lines.push(words.turned(index + 1, reading.draws, named(placed)))
  lines.push(words.position(where(index), positionMeaning(method.id, position, locale)))
  lines.push(...meaningLines(getCard(placed.cardId), placed, '  ', words))
  if (turned.length > 0) {
    lines.push('', words.table, ...turned.map((p, i) => `  ${i + 1}. ${where(i)}: ${named(p)}`))
  }
  if (index + 1 === reading.draws) {
    lines.push('', words.last)
    lines.push(`${words.forPosition}: ${finalCardText(method, locale)}`)
    for (const text of followUpTexts(method, locale)) lines.push(`${words.ifApplies}: ${text}`)
  }
  return lines.join('\n')
}
