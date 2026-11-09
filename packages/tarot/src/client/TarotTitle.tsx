import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { TarotGlyph } from './TarotGlyph.tsx'
import css from './TarotPage.module.css'

type Props = PropsRuntime<'sidebar.right.pane.tab.title'> & PropsLocale<'tarot'>

/** The tab chip's title: the card glyph before the page's name, as the other tabs draw theirs. */
export function TarotTitle({ t }: Props) {
  return <span className={css.chipTitle}><TarotGlyph size={14} />{t('title')}</span>
}
