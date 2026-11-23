export const SITE_URL = 'https://swim-sheet.pages.dev'

export interface RouteMetaDef {
  titleKey: string
  descriptionKey: string
  canonicalPath: string
  index: boolean
  appendSuffix: boolean
}

const appMeta = (titleKey: string, descriptionKey: string): RouteMetaDef => ({
  titleKey,
  descriptionKey,
  canonicalPath: '',
  index: false,
  appendSuffix: true,
})

const staticRoutes: Record<string, RouteMetaDef> = {
  '/': appMeta('meta.live.title', 'meta.live.description'),
  '/live': appMeta('meta.live.title', 'meta.live.description'),
  '/about': {
    titleKey: 'meta.landing.title',
    descriptionKey: 'meta.landing.description',
    canonicalPath: '/about',
    index: true,
    appendSuffix: false,
  },
  '/privacy': {
    titleKey: 'meta.privacy.title',
    descriptionKey: 'meta.privacy.description',
    canonicalPath: '',
    index: true,
    appendSuffix: true,
  },
  '/terms': {
    titleKey: 'meta.terms.title',
    descriptionKey: 'meta.terms.description',
    canonicalPath: '',
    index: true,
    appendSuffix: true,
  },
  '/auth/callback': appMeta('meta.authCallback.title', 'meta.authCallback.description'),
  '/dashboard': appMeta('meta.dashboard.title', 'meta.dashboard.description'),
  '/swimmers': appMeta('meta.swimmers.title', 'meta.swimmers.description'),
  '/sessions': appMeta('meta.sessions.title', 'meta.sessions.description'),
  '/sessions/catalog': appMeta('meta.catalog.title', 'meta.catalog.description'),
  '/drills': appMeta('meta.drills.title', 'meta.drills.description'),
  '/settings': appMeta('meta.settings.title', 'meta.settings.description'),
  '/runs': appMeta('meta.runs.title', 'meta.runs.description'),
}

const patternRoutes: { prefix: string; meta: RouteMetaDef }[] = [
  { prefix: '/swimmers/', meta: appMeta('meta.swimmerDetail.title', 'meta.swimmerDetail.description') },
  { prefix: '/sessions/', meta: appMeta('meta.sessionDetail.title', 'meta.sessionDetail.description') },
  { prefix: '/runs/', meta: appMeta('meta.runDetail.title', 'meta.runDetail.description') },
]

export function resolveRouteMeta(pathname: string): RouteMetaDef {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  const staticMatch = staticRoutes[path]
  if (staticMatch) return { ...staticMatch, canonicalPath: path }

  for (const { prefix, meta } of patternRoutes) {
    if (path.startsWith(prefix) && path.slice(prefix.length).length > 0) {
      return { ...meta, canonicalPath: path }
    }
  }

  return { ...appMeta('meta.default.title', 'meta.default.description'), canonicalPath: path, appendSuffix: false }
}
