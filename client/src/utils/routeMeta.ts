export const SITE_URL = 'https://swim-sheet.pages.dev'

export interface RouteMeta {
  title: string
  description: string
  canonicalPath: string
  index: boolean
}

const APP_SUFFIX = ' | Swim Sheet'

const appMeta = (title: string, description: string): RouteMeta => ({
  title: title + APP_SUFFIX,
  description,
  canonicalPath: '',
  index: false,
})

const landingMeta: RouteMeta = {
  title: 'Swim Sheet — Swim Coaching Session Management',
  description:
    'Swim Sheet is a free swim coaching app for building practice plans, running live timing on deck, and tracking swimmers — works offline on any device.',
  canonicalPath: '/about',
  index: true,
}

const staticRoutes: Record<string, RouteMeta> = {
  '/': appMeta('Live Deck', 'Live timing deck for running swim practices on deck, lap by lap.'),
  '/live': appMeta('Live Deck', 'Live timing deck for running swim practices on deck, lap by lap.'),
  '/about': landingMeta,
  '/auth/callback': appMeta('Signing In', 'Completing sign-in.'),
  '/dashboard': appMeta('Coach Dashboard', 'Overview of recent sessions, runs, and roster activity.'),
  '/swimmers': appMeta('Swimmers', 'Manage your swimmer roster, groups, and notes.'),
  '/sessions': appMeta('Sessions', 'Build and organize swim practice session templates.'),
  '/sessions/catalog': appMeta('Session Catalog', 'Browse the catalog of ready-made session templates.'),
  '/drills': appMeta('Drill Bank', 'Library of swim drills by stroke, focus, and phase.'),
  '/settings': appMeta('Settings', 'Configure Swim Sheet preferences and appearance.'),
  '/runs': appMeta('Run History', 'History of completed practice runs with results.'),
}

const patternRoutes: { prefix: string; meta: RouteMeta }[] = [
  { prefix: '/swimmers/', meta: appMeta('Swimmer Details', 'Swimmer profile with groups, notes, and history.') },
  { prefix: '/sessions/', meta: appMeta('Session Details', 'Session plan with drills, sets, and structure.') },
  { prefix: '/runs/', meta: appMeta('Run Details', 'Detailed results from a completed practice run.') },
]

export function resolveRouteMeta(pathname: string): RouteMeta {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  const staticMatch = staticRoutes[path]
  if (staticMatch) return { ...staticMatch, canonicalPath: path }

  for (const { prefix, meta } of patternRoutes) {
    if (path.startsWith(prefix) && path.slice(prefix.length).length > 0) {
      return { ...meta, canonicalPath: path }
    }
  }

  return { ...appMeta('Swim Sheet', 'Swim coaching session management and timing.'), canonicalPath: path }
}
