import { cardName, finalCardText, followUpTexts, getCard, getMethod, guidanceTexts, pickLocale, positionMeaning, positionName, rankName, type Card, type Recurrence } from '@dsh-rws-tarot/data'
import type { Placed } from './pack.ts'
import { isLayout, type LayoutId } from './layouts.ts'
import { PLAIN_METHOD } from './plain.ts'
import { newRecurrences } from './recurrence.ts'
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
  readonly recurrence: (count: number, rank: string, reversed: boolean, means: string) => string
  readonly layoutStyle: Readonly<Record<LayoutId, readonly string[]>>
  readonly layoutLast: Readonly<Record<LayoutId, string>>
  /** The three-card layout's places in order: past, present, future. */
  readonly threeSlots: readonly string[]
  readonly nineRows: readonly Slot[]
  readonly nineColumns: readonly Slot[]
  readonly nineCell: (row: string, column: string) => string
  readonly nineCentre: string
  readonly nineCorner: string
  readonly ended: (drawn: number, total: number) => string
}

interface Slot {
  readonly name: string
  readonly meaning: string
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
  recurrence: (count, rank, reversed, means) => `${count} ${rank}s${reversed ? ' reversed' : ''} now lie on the table together: ${means}.`,
  plainLast: 'This is the last card. After speaking to it, bring the cards together into one closing reading that answers them.',
  layoutStyle: {
    three: [
      'You are reading tarot for the person asking. Three cards are laid for the past, the present and the future, and each card they turn over is handed to you as it appears.',
      '',
      'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table. Say what the card means in the place where it fell and, once other cards are down, how it works with them: what is passing away, what surrounds them now, what is coming.',
      'Use plain flowing prose: no headings, lists, bold or card numbers, and put the position in your own words instead of quoting its label. In the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
      'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph for each card is enough.',
    ],
    nine: [
      'You are reading tarot for the person asking. Nine cards are laid in three rows of three, and each card they turn over is handed to you as it appears, the top row first and each row from left to right. The columns are stretches of time (the past, the present and the near future, no further than about a month ahead) and the rows are levels (what they think and aim for, the reality of their days, and the undercurrent beneath). Every card has a place of its own, given with it.',
      '',
      'How to answer: speak to them directly, as "you", the way a thoughtful reader would across a table. Say what the card means in the place where it fell and, once other cards are down, how it works with them and with its neighbours.',
      'Use plain flowing prose: no headings, lists, bold or card numbers, and put the position in your own words instead of quoting its label. In the meanings below, "him", "he" and "the Querent" mean the person asking or the matter asked about; never use the word "Querent" yourself.',
      'Do not name or cite any source, do not write "according to" or "the text says", do not list or quote the meanings below, and do not bring in meanings that are not given here. A short paragraph for each card is enough.',
    ],
  },
  layoutLast: {
    three: 'This is the last card. After speaking to it, bring the past, the present and the future together into one closing reading that answers them.',
    nine: 'This is the last card. After speaking to it, read the nine together: each column as a stretch of time, each row as a level, the corners as the frame of the matter, the two cards at the ends of each row against one another, and the two diagonals as the direction things are moving. Then bring it all into one closing reading that answers them.',
  },
  threeSlots: ['Past', 'Present', 'Future'],
  nineRows: [
    { name: 'Thought', meaning: 'what is above them: their ideas, dreams and aspirations, what they aim for' },
    { name: 'Reality', meaning: 'their present state and day-to-day life, whether hard or good' },
    { name: 'Undercurrent', meaning: 'the foundations the matter rests on: where they come from and what they carry with them' },
  ],
  nineColumns: [
    { name: 'Past', meaning: 'what lies behind' },
    { name: 'Present', meaning: 'what is now' },
    { name: 'Near future', meaning: 'what awaits them soon' },
  ],
  nineCell: (row, column) => `${row}, ${column}`,
  nineCentre: 'It lies at the centre: the underlying theme of the whole reading, its core and essence.',
  nineCorner: 'It lies at a corner, and with the other corners frames the context of the reading.',
  ended: (drawn, total) => `The person has ended the reading after ${drawn} of ${total} cards. Set it aside: say nothing more of its cards, and do not carry them into whatever they ask next unless they ask you to.`,
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
  recurrence: (count, rank, reversed, means) => `桌上现在有 ${count} 张${reversed ? '逆位' : ''}${rank}：${means}。`,
  plainLast: '这是最后一张牌。说完这张之后，把所有的牌合起来，给出一个回答他们问题的总结。',
  layoutStyle: {
    three: [
      '你正在为提问的人占卜塔罗。三张牌分别代表过去、现在和未来，他们每翻开一张牌，这张牌就会交到你手里。',
      '',
      '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”。说清这张牌落在这个位置上意味着什么；等桌上有了别的牌，再说它们如何彼此呼应：什么正在过去，什么围绕着你，什么即将到来。',
      '用平实流畅的行文：不要标题、列表、粗体和牌的序号；位置请用你自己的话说出来，不要照搬位置名称。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
      '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每张牌写一小段就够了。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
    ],
    nine: [
      '你正在为提问的人占卜塔罗。九张牌排成三行三列，他们每翻开一张牌，这张牌就会交到你手里，先翻第一行，每行从左到右。每一列是一段时间（过去、现在和近期，最多看到大约一个月之内），每一行是一个层面（他们的想法与追求、日常的现实、以及底下的暗流）。每张牌都有自己的位置，会随牌一同给出。',
      '',
      '回答方式：像一位体贴的占卜师坐在桌子对面那样，直接对他们说话，用“你”。说清这张牌落在这个位置上意味着什么；等桌上有了别的牌，再说它如何与它们、与身旁的牌彼此呼应。',
      '用平实流畅的行文：不要标题、列表、粗体和牌的序号；位置请用你自己的话说出来，不要照搬位置名称。下面资料里的“他”和“Querent”都指提问的人或所问之事，你自己说话时不要使用“Querent”这个词。',
      '不要提及或引用任何出处，不要写“根据”“书中说”，不要罗列或照抄下面的牌义，也不要加入下面没有给出的含义。每张牌写一小段就够了。资料中的牌义是英文原文，请用你自己的话、用中文回答。',
    ],
  },
  layoutLast: {
    three: '这是最后一张牌。说完这张之后，把过去、现在和未来合起来，给出一个回答他们问题的总结。',
    nine: '这是最后一张牌。说完这张之后，把九张牌放在一起读：每一列是一段时间，每一行是一个层面，四个角给事情定下背景，每一行两端的牌互相对照，两条对角线显示事情发展的方向。然后把这一切合成一个回答他们问题的总结。',
  },
  threeSlots: ['过去', '现在', '未来'],
  nineRows: [
    { name: '思想', meaning: '他们头顶之上的东西：想法、梦想与追求，他们所向往的' },
    { name: '现实', meaning: '他们目前的状况与日常生活，无论艰难还是顺遂' },
    { name: '暗流', meaning: '事情所依托的根基：他们从何而来，身上带着什么' },
  ],
  nineColumns: [
    { name: '过去', meaning: '身后的事' },
    { name: '现在', meaning: '眼下的事' },
    { name: '近期', meaning: '不久后等待他们的事' },
  ],
  nineCell: (row, column) => `${row}，${column}`,
  nineCentre: '它位于正中：整个占卜的底层主题，核心与本质。',
  nineCorner: '它位于一个角上，与其他三个角一起为这次占卜勾勒背景。',
  ended: (drawn, total) => `对方在第 ${drawn} 张（共 ${total} 张）之后结束了这次占卜。请把它搁在一边：不要再谈它的牌，除非对方要求，也不要把这些牌带进他们接下来问的事。`,
}

const WORDS: Readonly<Record<string, Words>> = { en, zh }

/** What the book says when this turn brings two or more cards of one rank onto the table. */
function recurrenceLines(reading: Reading, from: number, size: number, words: Words): string[] {
  const found = newRecurrences(reading.order.slice(0, from), reading.order.slice(from, from + size))
  return found.length === 0 ? [] : ['', ...found.map((r: Recurrence) => words.recurrence(r.count, rankName(r.rank, reading.language), r.position === 'reversed', r.means))]
}

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
  lines.push(...recurrenceLines(reading, index, 1, words))
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
  out.push(...recurrenceLines(reading, from, turn.size, words))
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
  out.push(...recurrenceLines(reading, index, 1, words))
  if (index + 1 === reading.draws) out.push('', words.plainLast)
  return out.join('\n')
}

/** The place card `index` of a layout lies in: its name, and what that place stands for. */
function layoutSlot(id: LayoutId, index: number, locale: string, words: Words): Slot {
  if (id === 'three') {
    // The book's own account of what is behind, around and before the person, here the one card each place has.
    const celtic = getMethod('celtic')
    const position = celtic.positions[[4, 0, 5][index]!]!
    return { name: words.threeSlots[index]!, meaning: positionMeaning(celtic.id, position, locale) }
  }
  const row = words.nineRows[Math.floor(index / 3)]!
  const column = words.nineColumns[index % 3]!
  const role = index === 4 ? words.nineCentre : index % 2 === 0 ? words.nineCorner : null
  return { name: words.nineCell(row.name, column.name), meaning: [`${row.meaning}; ${column.meaning}.`, role].filter(Boolean).join(' ') }
}

/** The same for a modern layout of three or nine cards: the card just turned, its place and the places already filled. */
function describeLayout(reading: Reading, id: LayoutId, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const placed = reading.order[index]
  if (placed === undefined || index >= reading.drawn) throw new RangeError(`describeTurn: card ${index + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const slot = (i: number): Slot => layoutSlot(id, i, locale, words)
  const out: string[] = []
  if (index === 0) {
    out.push(...words.layoutStyle[id], '')
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
  }
  out.push(words.turned(index + 1, reading.draws, named(placed)))
  out.push(words.position(slot(index).name, slot(index).meaning), ...meaningLines(getCard(placed.cardId), placed, '  ', words))
  if (index > 0) out.push('', words.table, ...reading.order.slice(0, index).map((p, i) => `  ${i + 1}. ${slot(i).name}: ${named(p)}`))
  out.push(...recurrenceLines(reading, index, 1, words))
  if (index + 1 === reading.draws) out.push('', words.layoutLast[id])
  return out.join('\n')
}

/** What to tell the model when the person ends a reading before its last card. */
export function describeEnd(reading: Reading): string {
  return pickLocale(WORDS, reading.language, 'en').ended(reading.drawn, reading.draws)
}

/** What to put in front of the model when the person turns up the next cards of a reading, from card `from`. */
export function describeTurn(reading: Reading, from: number): string {
  if (reading.method === PLAIN_METHOD) return describePlain(reading, from)
  if (isLayout(reading.method)) return describeLayout(reading, reading.method, from)
  return getMethod(reading.method).kind === 'celtic' ? describeCard(reading, from) : describeLine(reading, from)
}
