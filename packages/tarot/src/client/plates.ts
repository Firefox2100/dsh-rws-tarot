import plates from 'virtual:rws-plates'
import type { Card } from '@dsh-rws-tarot/data'

/** Where the host serves a card's plate: the package-asset URL the build gave its file, relative to the page. */
export function plateUrl(card: Card): string {
  return plates[card.image.file.slice(card.image.file.lastIndexOf('/') + 1)]!
}
