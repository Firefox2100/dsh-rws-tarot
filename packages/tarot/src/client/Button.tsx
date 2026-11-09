import type { ButtonHTMLAttributes, ReactNode } from 'react'
import css from './Button.module.css'

export type ButtonVariant = 'primary' | 'outline'

/**
 * A small action button shaped like the host's: 24px tall, token colours, the standard focus ring.
 * It is ours rather than a Harness Client import, so a change in the host's primitives cannot blank this page.
 */
export function Button({ variant = 'outline', size = 'sm', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; children?: ReactNode }) {
  return (
    <button type="button" className={[css.button, css[variant], css[size], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  )
}
