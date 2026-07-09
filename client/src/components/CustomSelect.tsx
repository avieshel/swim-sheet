import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string | number
  label: string
}

interface CustomSelectProps {
  value: string | number
  options: SelectOption[]
  onChange: (value: string | number) => void
  placeholder?: string
  className?: string
  label?: string
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, className = '', label }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-surface-container-lowest border-b-2 border-outline focus:border-primary px-2 py-1.5 text-sm outline-none rounded-t-md transition-colors text-left"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : 'Select...'}</span>
        <span className="material-symbols-outlined text-sm transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in duration-100">
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-container/20 transition-colors ${
                  value === opt.value ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
