// Single source of truth for Hebrew drill localization and AI matching aliases.
//
// Keyed by the drill catalog slug. `heName` is the reviewed Hebrew display name.
// `aliases` are extra Hebrew coach shorthands/synonyms used by the AI harness
// matcher (the heName itself is also matched automatically by code).
//
// Both the client catalog and the Supabase ai-session-harness consume this file.

export interface DrillHebrewLocalization {
  heName: string
  aliases?: string[]
  hint?: string
}

export const DRILL_HEBREW: Record<string, DrillHebrewLocalization> = {
  'fingertip-drag': {
    heName: 'שריטת מים',
    aliases: ['גרירת אצבעות'],
  },
  'catch-up-drill': {
    heName: 'יד מחכה ליד',
  },
  '6-1-6-breathing': {
    heName: 'נשימה 6-1-6',
  },
  'side-kicking': {
    heName: 'בעיטה על הצד',
  },
  'single-arm-pull': {
    heName: 'יד אחת',
    aliases: ['יד-יד'],
  },
  'single-arm-pull-arm-extended': {
    heName: 'יד אחת - יד מוארכת קדימה',
    aliases: ['יד-יד יד מוארכת'],
    hint: 'other arm extended forward',
  },
  'single-arm-pull-arm-by-side': {
    heName: 'יד אחת - יד לצד הגוף',
    aliases: ['יד-יד יד לצד הגוף'],
    hint: 'other arm by side',
  },
  'fist-drill': {
    heName: 'אגרופים',
  },
  'tarzan-drill': {
    heName: 'כדור מים',
  },
  'sculling': {
    heName: 'סקאלינג',
  },
  'body-rotation-drill': {
    heName: 'פוקוס גלגול גוף',
  },
  'dolphin-kick': {
    heName: 'דולפין',
  },
  'dolphin-kick-on-back': {
    heName: 'דולפין על הגב',
  },
  'im-order-practice': {
    heName: 'מעורב',
  },
  'descending-set': {
    heName: 'דיסנד',
  },
  'zipper-drill': {
    heName: 'זיפרים',
  },
  '6-kick-switch': {
    heName: 'החלפה כל 6 בעיטות',
  },
  'superman-glide': {
    heName: 'סופרמן',
  },
  'shark-fin': {
    heName: 'סנפיר כריש',
  },
  'double-arm-pulls': {
    heName: 'גריפה בשתי ידיים בו זמנית',
  },
  'long-dog': {
    heName: 'כלב',
  },
  'pull-buoy-between-ankles': {
    heName: 'פולי בקרסוליים',
  },
  'straight-arm-pull': {
    heName: 'תחנת רוח',
  },
  'breath-every-stroke': {
    heName: 'נשימה בכל חתירה',
  },
  'freestyle-with-dolphin-kicks': {
    heName: 'ידיים חתירה רגלים פרפר',
  },
}
