export const strokeColors: Record<string, string> = {
  freestyle: 'bg-blue-100 text-blue-700',
  backstroke: 'bg-emerald-100 text-emerald-700',
  breaststroke: 'bg-purple-100 text-purple-700',
  butterfly: 'bg-pink-100 text-pink-700',
  im: 'bg-amber-100 text-amber-700',
}

export const strokeColorsSolid: Record<string, string> = {
  freestyle: 'bg-blue-400',
  backstroke: 'bg-emerald-400',
  breaststroke: 'bg-purple-400',
  butterfly: 'bg-pink-400',
  im: 'bg-amber-400',
}

export const strokeOptions = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'backstroke', label: 'Backstroke' },
  { value: 'breaststroke', label: 'Breaststroke' },
  { value: 'butterfly', label: 'Butterfly' },
  { value: 'im', label: 'IM' },
]

export const TECHNIQUE_LABELS = ['catch', 'kick', 'body position', 'rotation', 'rhythm', 'streamline', 'pullout', 'breathing']
export const FITNESS_LABELS = ['speed', 'endurance', 'strength', 'anaerobic', 'aerobic', 'sprint', 'pacing']
export const PHASE_LABELS = ['warmup', 'pre-set', 'main set', 'cool down', 'taper']
export const EQUIPMENT_OPTIONS = [
  { id: 'fins', label: 'Fins' },
  { id: 'paddles', label: 'Paddles' },
  { id: 'pullbuoy', label: 'Pull Buoy' },
  { id: 'snorkel', label: 'Snorkel' },
]

export const EQUIPMENT_DATA: Record<string, { label: string; icon: string }> = {
  fins: { label: 'Fins', icon: 'fins' },
  zoomers: { label: 'Zoomers', icon: 'zoomers' },
  paddles: { label: 'Paddles', icon: 'paddles' },
  pullbuoy: { label: 'Pull Buoy', icon: 'pullbuoy' },
  snorkel: { label: 'Snorkel', icon: 'snorkel' },
}
