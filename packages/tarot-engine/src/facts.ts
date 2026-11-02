import { cardName, finalCardText, followUpTexts, getCard, getMethod, guidanceTexts, pickLocale, positionMeaning, positionName, type Card } from '@dsh-rws-tarot/data'
import type { Placed } from './pack.ts'
import { PLAIN_METHOD } from './plain.ts'
import { turnAt, type Reading } from './table.ts'

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
  readonly linesStyle: readonly string[]
  readonly querent: (name: string) => string
  readonly lineTurned: (n: number, total: number, rightToLeft: boolean) => string
  readonly lineCard: (n: number, name: string) => string
  readonly lineName: (n: number) => string
  readonly separator: string
  readonly linesLast: string
  readonly continueStyle: readonly string[]
  readonly continueLast: string
  readonly guidance: string
  readonly plainStyle: readonly string[]
  readonly plainTurned: (n: number, total: number, name: string) => string
  readonly plainLast: string
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
  linesStyle: [
    'You are reading tarot for the person asking, who wants to hear generally about the course of their life. Forty-two cards are laid in six lines of seven, and each line they turn over is handed to you as it appears, its cards read one after another from the right of the line to its left.',
    '',
    'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table. Say what each card means here, and how it works with the cards beside it and with those already down.',
    'Use plain flowing prose: no headings, lists, bold or card numbers. In the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
    'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph or two for each line is enough: take the cards of a line together rather than one by one.',
  ],
  querent: name => `The card standing for them lies face up beside the first line: ${name}.`,
  lineTurned: (n, total, rtl) => `Line ${n} of ${total} has just been turned over. Its cards, from the ${rtl ? 'right of the line to its left' : 'left of the line to its right'}:`,
  lineCard: (n, name) => `Card ${n}: ${name}`,
  lineName: n => `Line ${n}`,
  separator: ', ',
  linesLast: 'This is the last line. After speaking to it, bring the whole layout together into one closing reading of the general course of their life.',
  continueStyle: [
    'You are carrying a tarot reading further for the person asking, because something remained doubtful or they want to take the question on. The cards that were left over are laid in six lines of unequal length, and each line they turn over is handed to you as it appears, its cards read from the left of the line to its right. Every line has a meaning of its own, given with it.',
    '',
    'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table, and tie what each line shows to what has already been said in this conversation. Take the cards of a line together rather than one by one.',
    'Use plain flowing prose: no headings, lists, bold or card numbers, and put the line\'s meaning in your own words instead of quoting its label. In the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
    'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph or two for each line is enough.',
  ],
  continueLast: 'This is the last line. After speaking to it, bring the six lines together, and say what they add to the reading before.',
  guidance: 'Keep in mind',
  plainStyle: [
    'You are reading tarot for the person asking. They draw a few cards one at a time, and each card they turn over is handed to you as it appears. The cards have no positions: each speaks for itself, and with the others on the table.',
    '',
    'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table. Say what the card means for what they ask and, once other cards are down, how it works with them.',
    'Use plain flowing prose: no headings, lists, bold or card numbers. In the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
    'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph for each card is enough.',
  ],
  plainTurned: (n, total, name) => `Card ${n} of ${total} has just been turned over: ${name}.`,
  plainLast: 'This is the last card. After speaking to it, bring the cards together into one closing reading that answers them.',
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
  linesStyle: [
    '你正在为提问的人占卜塔罗，他们想大致了解自己人生的走向。四十二张牌排成六行，每行七张；他们每翻开一行，这一行就会交到你手里，行内的牌从右到左依次解读。',
    '',
    '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”。说清每张牌在这里意味着什么，以及它如何与身旁的牌、与桌上已有的牌彼此呼应。',
    '用平实流畅的行文：不要标题、列表、粗体和牌的序号。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
    '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每一行写一两小段就够了，把一行里的牌放在一起说，不必逐张分开。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
  ],
  querent: name => `代表他们的牌正面朝上，放在第一行旁边：${name}。`,
  lineTurned: (n, total, rtl) => `第 ${n} 行（共 ${total} 行）刚刚翻开。行内的牌，从${rtl ? '右到左' : '左到右'}依次是：`,
  lineCard: (n, name) => `第 ${n} 张：${name}`,
  lineName: n => `第 ${n} 行`,
  separator: '、',
  linesLast: '这是最后一行。说完这一行之后，把整个牌阵合起来，给出一个关于他们人生大致走向的总结。',
  continueStyle: [
    '你正在为提问的人把这次占卜继续下去，因为还有存疑之处，或者他们想把问题再深入一步。上一轮没有用到的牌被排成六行，各行长短不一；他们每翻开一行，这一行就会交到你手里，行内的牌从左到右依次解读。每一行都有自己的含义，会随牌一同给出。',
    '',
    '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”，并把每一行所显示的内容与这场对话里已经说过的话联系起来。把一行里的牌放在一起说，不必逐张分开。',
    '用平实流畅的行文：不要标题、列表、粗体和牌的序号；这一行的含义请用你自己的话说出来，不要照搬名称。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
    '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每一行写一两小段就够了。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
  ],
  continueLast: '这是最后一行。说完这一行之后，把六行合起来，说说它们为先前的占卜补充了什么。',
  guidance: '请记住',
  plainStyle: [
    '你正在为提问的人占卜塔罗。他们一张一张地抽牌，每翻开一张牌，这张牌就会交到你手里。这些牌没有固定的位置：每张牌各自说话，也与桌上的其他牌彼此呼应。',
    '',
    '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”。说清这张牌对他们所问之事意味着什么；等桌上有了别的牌，再说它们如何彼此呼应。',
    '用平实流畅的行文：不要标题、列表、粗体和牌的序号。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
    '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每张牌写一小段就够了。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
  ],
  plainTurned: (n, total, name) => `第 ${n} 张（共 ${total} 张）刚刚翻开：${name}。`,
  plainLast: '这是最后一张牌。说完这张之后，把所有的牌合起来，给出一个回答他们问题的总结。',
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
  const method = getMethod('celtic')
  if (reading.method !== method.id) throw new RangeError(`describeCard: ${reading.method} is not read one card at a time`)
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

/** The same for a layout read a line at a time: the line just turned, the lines already down, and each card's meanings. */
function describeLine(reading: Reading, from: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const method = getMethod(reading.method)
  if (method.kind === 'celtic') throw new RangeError(`describeTurn: ${method.id} is read a card at a time`)
  const turn = turnAt(reading, from)
  if (turn === undefined || from + turn.size > reading.drawn) throw new RangeError(`describeTurn: the line from card ${from + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const lines = reading.turns.length
  const rtl = method.direction === 'right-to-left'
  const out: string[] = []

  if (from === 0) {
    if (method.kind === 'lines') {
      out.push(...words.linesStyle, '')
    } else {
      out.push(...words.continueStyle, '')
    }
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
    if (method.kind === 'lines') {
      if (reading.significator !== null) {
        out.push(words.querent(named(reading.significator)), ...meaningLines(getCard(reading.significator.cardId), reading.significator, '  ', words), '')
      }
      for (const text of guidanceTexts(method, locale)) out.push(`${words.guidance}: ${text}`)
      out.push('')
    }
  }

  out.push(words.lineTurned(turn.turn + 1, lines, rtl))
  const position = method.kind === 'continuation' ? method.positions[turn.turn] : undefined
  if (position !== undefined) out.push(words.position(positionName(method.id, position, locale), positionMeaning(method.id, position, locale)))
  reading.order.slice(from, from + turn.size).forEach((placed, i) => {
    out.push(words.lineCard(i + 1, named(placed)), ...meaningLines(getCard(placed.cardId), placed, '  ', words))
  })
  if (from > 0) {
    out.push('', words.table)
    let start = 0
    for (const [i, size] of reading.turns.slice(0, turn.turn).entries()) {
      out.push(`  ${words.lineName(i + 1)}: ${reading.order.slice(start, start + size).map(named).join(words.separator)}`)
      start += size
    }
  }
  if (turn.turn + 1 === lines) out.push('', method.kind === 'lines' ? words.linesLast : words.continueLast)
  return out.join('\n')
}

/** The same for a plain draw: the card just turned and those already down, with no positions. */
function describePlain(reading: Reading, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const placed = reading.order[index]
  if (placed === undefined || index >= reading.drawn) throw new RangeError(`describeTurn: card ${index + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const out: string[] = []
  if (index === 0) {
    out.push(...words.plainStyle, '')
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
  }
  out.push(words.plainTurned(index + 1, reading.draws, named(placed)), ...meaningLines(getCard(placed.cardId), placed, '  ', words))
  if (index > 0) out.push('', words.table, ...reading.order.slice(0, index).map((p, i) => `  ${i + 1}. ${named(p)}`))
  if (index + 1 === reading.draws) out.push('', words.plainLast)
  return out.join('\n')
}

/** What to put in front of the model when the person turns up the next cards of a reading, from card `from`. */
export function describeTurn(reading: Reading, from: number): string {
  if (reading.method === PLAIN_METHOD) return describePlain(reading, from)
  return getMethod(reading.method).kind === 'celtic' ? describeCard(reading, from) : describeLine(reading, from)
}
