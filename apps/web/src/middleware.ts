import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, isValidLocale, locales } from './i18n/config'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for Payload admin, API routes, and static files
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return NextResponse.next()
  }

  // Redirect to default locale if no locale in pathname
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

function getLocale(request: NextRequest): string {
  // Check for locale in cookie
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  if (localeCookie && isValidLocale(localeCookie)) {
    return localeCookie
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(',')[0]
      ?.split('-')[0]
      ?.toLowerCase()

    if (preferredLocale && isValidLocale(preferredLocale)) {
      return preferredLocale
    }
  }

  return defaultLocale
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, etc)
    '/((?!api|_next/static|_next/image|favicon.ico|admin).*)',
  ],
}
