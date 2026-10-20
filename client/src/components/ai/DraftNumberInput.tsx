import { useState } from 'react'

interface DraftNumberInputProps {
  value: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
}

// A number input is editable text, but the staged draft can only hold a
// positive integer. Coercing on every keystroke would make clearing the field
// snap it to the low bound, so typing "12" over "10" would land on "112".
// Keep the raw text locally and only publish a value once it parses; blur
// restores the last published one if the text is unusable.
export function DraftNumberInput({ value, min, max, label, onChange }: DraftNumberInputProps) {
  const [text, setText] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)

  // Reset the text when the value changes from outside (a reordering move, or a
  // regeneration). Adjusting during render rather than in an effect avoids the
  // cascading render an effect would cause.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(String(value))
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={label}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const parsed = Number.parseInt(raw, 10)
        if (!Number.isFinite(parsed)) return
        onChange(Math.min(max, Math.max(min, parsed)))
      }}
      onBlur={() => setText(String(value))}
      className="w-full min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
    />
  )
}
