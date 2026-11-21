export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
export type IconColor = 'primary' | 'error' | 'on-surface-variant' | 'on-error' | 'current'

export interface IconProps {
  name: string
  size?: IconSize
  color?: IconColor
  fill?: boolean
  className?: string
  style?: React.CSSProperties
  mirrorInRtl?: boolean
}

const DIRECTIONAL_ICONS = new Set([
  'arrow_back',
  'arrow_forward',
  'chevron_left',
  'chevron_right',
  'fast_forward',
  'fast_rewind',
  'navigate_before',
  'navigate_next',
  'keyboard_arrow_left',
  'keyboard_arrow_right',
  'first_page',
  'last_page',
  'undo',
  'redo',
])

const SIZE_CLASSES: Record<IconSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
  '2xl': 'text-3xl',
  '3xl': 'text-4xl',
  '4xl': 'text-5xl',
}

const COLOR_CLASSES: Record<IconColor, string> = {
  primary: 'text-primary',
  error: 'text-error',
  'on-surface-variant': 'text-on-surface-variant',
  'on-error': 'text-on-error',
  current: '',
}

export function Icon({ name, size = 'md', color = 'current', fill = false, className = '', style, mirrorInRtl }: IconProps) {
  const sizeClass = SIZE_CLASSES[size]
  const colorClass = COLOR_CLASSES[color]
  const fillStyle = fill ? { fontVariationSettings: "'FILL' 1" } : undefined
  const mergedStyle = { ...fillStyle, ...style }
  const shouldMirror = mirrorInRtl ?? DIRECTIONAL_ICONS.has(name)
  const mirrorClass = shouldMirror ? 'rtl:-scale-x-100' : ''

  return (
    <span
      className={`material-symbols-outlined ${sizeClass} ${colorClass} ${mirrorClass} ${className}`.trim()}
      style={mergedStyle}
    >
      {name}
    </span>
  )
}