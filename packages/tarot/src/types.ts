import type { Placed } from '@dsh-rws-tarot/engine'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-projection/types'

/** What a client may see of one reading: only the cards already turned up, never the rest of the pack. */
export interface ReadingView {
  id: string
  method: string
  significator: Placed | null
  facing: 'left' | 'right' | null
  question: string
  language: string
  draws: number
  drawn: Placed[]
}

export interface TarotView {
  readings: ReadingView[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    tarot: TarotView
  }
}
