'use client'

import { useRouter, usePathname } from 'next/navigation'
import { locales, localeNames, type Locale } from '@/i18n/config'

type Props = {
  currentLocale: Locale
}

const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
}

export function LanguageSelector({ currentLocale }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLocaleChange = (newLocale: Locale) => {
    // Replace the current locale in the pathname
    const segments = pathname.split('/')
    segments[1] = newLocale
    const newPath = segments.join('/')

    // Set cookie and navigate
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    router.push(newPath)
  }

  return (
    <div className="flex gap-2 items-center">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          className={`
            relative px-3 py-2 rounded-lg text-2xl
            transition-all duration-300 ease-in-out
            transform hover:scale-110 active:scale-95
            ${
              currentLocale === locale
                ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                : 'bg-transparent hover:bg-gray-100'
            }
          `}
          title={localeNames[locale]}
          aria-label={`Switch to ${localeNames[locale]}`}
        >
          <span
            role="img"
            aria-label={localeNames[locale]}
            className={`
              inline-block transition-all duration-300
              ${currentLocale === locale ? 'animate-pulse' : ''}
            `}
          >
            {localeFlags[locale]}
          </span>
          {currentLocale === locale && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full animate-bounce" />
          )}
        </button>
      ))}
    </div>
  )
}
