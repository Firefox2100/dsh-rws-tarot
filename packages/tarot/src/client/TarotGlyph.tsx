import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * The guide's glyph for the Tarot page: one card carrying the Star, drawn in the product's 16px line style.
 * It belongs to this plugin alone, so it lives here rather than in the shared icon set; without a glyph the guide
 * draws its cube placeholder instead.
 */
export function TarotGlyph({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true" focusable="false">
      <rect x="3.6" y="1.9" width="8.8" height="12.2" rx="1.7" stroke="currentColor" strokeWidth="1" />
      <path d="M8 5L8.81 7.19L11 8L8.81 8.81L8 11L7.19 8.81L5 8L7.19 7.19Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
