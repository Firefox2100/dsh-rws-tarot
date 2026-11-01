import type { Card } from '@dsh-rws-tarot/data'

/** Where the host serves a card's plate, relative to the page so a prefixed deployment still finds it. */
export function plateUrl(card: Card): string {
  const file = card.image.file.slice(card.image.file.lastIndexOf('/') + 1)
  return new URL(`rws-tarot/plates/${file}`, document.baseURI).href
}
