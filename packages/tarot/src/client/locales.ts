import dictionaries from './locales.json' with { type: 'json' }

export const en = dictionaries.en
export type TarotKey = keyof typeof en

export const zh: Record<TarotKey, string> = dictionaries.zh
export const de: Record<TarotKey, string> = dictionaries.de
export const es: Record<TarotKey, string> = dictionaries.es
export const fr: Record<TarotKey, string> = dictionaries.fr
export const ja: Record<TarotKey, string> = dictionaries.ja
export const pt: Record<TarotKey, string> = dictionaries.pt
export const ru: Record<TarotKey, string> = dictionaries.ru
