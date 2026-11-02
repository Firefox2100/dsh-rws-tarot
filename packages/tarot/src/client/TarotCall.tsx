import type { StartedToolCallViewProps, ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './TarotCall.module.css'

type Props = ToolCallViewProps & PropsLocale<'tarot'>
type T = Props['t']

const METHODS: Readonly<Record<string, 'method.celtic' | 'method.alt42' | 'method.alt35' | 'method.plain'>> = {
  celtic: 'method.celtic', alternative: 'method.alt42', thirtyfive: 'method.alt35', plain: 'method.plain',
}

const firstLine = (text: string): string => text.split('\n', 1)[0]!

/** What the call asked for, from its arguments alone; a half-streamed argument string shows the Celtic Cross default or nothing. */
function summary(argsRaw: string, t: T): string {
  let args: unknown
  try { args = JSON.parse(argsRaw) } catch { return '' }
  if (typeof args !== 'object' || args === null) return ''
  const { method, count } = args as { method?: unknown; count?: unknown }
  const id = typeof method === 'string' && method in METHODS ? method : 'celtic'
  const name = t(METHODS[id]!)
  return id === 'plain' && typeof count === 'number' ? `${name} · ${t('call.cards', { n: count })}` : name
}

function failure(block: StartedToolCallViewProps['block']): string | null {
  if (!('kind' in block) || block.isError !== true) return null
  const text = block.content.map(c => (c.type === 'text' ? c.text : '')).join('\n').trim()
  return firstLine(text === '' ? block.error?.code ?? '' : text)
}

/** The one row of the model's `tarot_lay_spread` call: what was laid, or why it could not be. Registered under that tool's key only. */
export function TarotCall(props: Props) {
  if (props.phase === 'preparing') {
    return <div className={css.row} data-state="preparing"><span className={css.title}>{props.t('call.title')}</span></div>
  }
  const { block, t } = props
  const settled = 'kind' in block
  const argsRaw = (settled ? block.call?.argsRaw : block.argsRaw) ?? ''
  const error = failure(block)
  const state = !settled ? 'running' : error !== null ? 'error' : 'ok'
  return (
    <div className={css.row} data-tool="tarot_lay_spread" data-state={state}>
      <span className={css.title}>{t('call.title')}</span>
      <span className={css.separator} aria-hidden />
      <span className={error !== null ? css.error : css.summary}>
        {error ?? (state === 'running' ? t('call.laying') : t('call.laid', { what: summary(argsRaw, t) }))}
      </span>
    </div>
  )
}
