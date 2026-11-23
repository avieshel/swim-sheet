import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n } from '../i18n'
import { resolveRouteMeta, SITE_URL } from '../utils/routeMeta'

function upsertMeta(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(name: string): void {
  document.head.querySelector(`meta[name="${name}"]`)?.remove()
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export const RouteMeta = () => {
  const { pathname } = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    const meta = resolveRouteMeta(pathname)
    const title = meta.appendSuffix ? t(meta.titleKey) + t('meta.appSuffix') : t(meta.titleKey)
    document.title = title
    upsertMeta('description', t(meta.descriptionKey))
    upsertLink('canonical', SITE_URL + meta.canonicalPath)
    if (meta.index) {
      removeMeta('robots')
    } else {
      upsertMeta('robots', 'noindex, nofollow')
    }
  }, [pathname, t])

  return null
}
