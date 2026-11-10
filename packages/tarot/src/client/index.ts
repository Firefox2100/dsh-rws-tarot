import type { Context } from '@deepseek-ai/cordis'
// Type-only: these pull in the Context and SlotMap augmentations this page relies on.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '../types.ts'
import { de, en, es, fr, ja, pt, ru, zh, type TarotKey } from './locales.ts'
import { TarotCall } from './TarotCall.tsx'
import { TarotGlyph } from './TarotGlyph.tsx'
import { TarotPage } from './TarotPage.tsx'
import { TarotTitle } from './TarotTitle.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    tarot: TarotKey
  }
}

const NAMESPACE = 'tarot'
const ID = 'dsh-rws-tarot'

/** What the page may do: run one of the plugin's commands against its session. */
export interface TarotInjected {
  /** @returns null when the command ran; its failure text otherwise. */
  run: (line: string) => Promise<string | null>
}

export const inject = ['slots', 'locale', 'remote', 'remote.commands', 'sidebarRightTabs']

/** A new page in the right dock, reachable from its guide, that adds nothing to any existing page. */
export function apply(ctx: Context): void {
  const t = ctx.locale.bind(NAMESPACE)
  ctx.effect(() => ctx.locale.register(NAMESPACE, { zh, en, de, es, fr, ja, pt, ru }), 'dsh-rws-tarot: dictionaries')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: 'tarot',
    title: () => t('title'),
    guide: [{ id: 'open', order: 40, title: () => t('title'), description: () => t('description'), icon: TarotGlyph }],
  }), 'dsh-rws-tarot: tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: ID,
    locale: NAMESPACE,
    inject: (sessionId: SessionId): TarotInjected => ({
      run: async (line) => {
        const result = await ctx.remote.commands.execute(sessionId, line, [])
        if (!result.ok) return `${result.error.message} (${result.error.code})`
        if (result.value === undefined) return `unknown command: ${line}`
        return result.value.result.kind === 'error' ? result.value.result.text : null
      },
    }),
  }, TarotPage)), 'dsh-rws-tarot: page')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: ID,
    locale: NAMESPACE,
  }, TarotTitle)), 'dsh-rws-tarot: tab title')
  // Keyed by the tool's own name: no other tool's row is touched.
  ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'tarot_lay_spread',
    locale: NAMESPACE,
  }, TarotCall)), 'dsh-rws-tarot: tool row')
}
