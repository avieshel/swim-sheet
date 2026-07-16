import { useState } from 'react'

const DEFAULT_PRESET = 18

export function StrokeCountStepper({ value, onChange }: {
  value: number | undefined
  onChange: (val: number | undefined) => void
}) {
  const [preset, setPreset] = useState(DEFAULT_PRESET)

  return (
    <span className="inline-flex items-center gap-0.5 select-none">
      <button onClick={() => onChange(value === preset ? undefined : preset)}
        className={`h-5 px-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer leading-none ${
          value === preset
            ? 'bg-primary text-on-primary shadow-xs'
            : 'bg-surface-variant text-on-surface-variant hover:bg-primary-container/60'
        }`}
      >
        {preset}
      </button>
      <span className="w-px h-4 bg-outline-variant/30 mx-0.5" />
      <button onClick={() => setPreset(p => Math.max(0, p - 1))}
        className="w-5 h-5 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-xs font-bold leading-none"
      >–</button>
      <button onClick={() => setPreset(p => p + 1)}
        className="w-5 h-5 rounded flex items-center justify-center bg-surface-variant text-on-surface-variant hover:bg-primary-container/60 transition-all cursor-pointer text-xs font-bold leading-none"
      >+</button>
    </span>
  )
}
