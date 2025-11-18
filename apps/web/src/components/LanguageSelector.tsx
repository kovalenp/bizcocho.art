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
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
      }}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          style={{
            padding: '0.5rem 0.75rem',
            border: currentLocale === locale ? '2px solid #007acc' : '2px solid transparent',
            borderRadius: '6px',
            background: currentLocale === locale ? '#f0f8ff' : 'transparent',
            cursor: 'pointer',
            fontSize: '1.5rem',
            lineHeight: 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          title={localeNames[locale]}
          aria-label={`Switch to ${localeNames[locale]}`}
        >
          <span role="img" aria-label={localeNames[locale]}>
            {localeFlags[locale]}
          </span>
        </button>
      ))}
    </div>
  )
}
