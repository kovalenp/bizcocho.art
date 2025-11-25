'use client'

import { useRouter, usePathname } from 'next/navigation'
import { type Locale } from '@/i18n/config'

type Props = {
  currentLocale: Locale
}

export function LanguageSelector({ currentLocale }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLocaleChange = (newLocale: Locale) => {
    if (currentLocale === newLocale) return

    // Replace the current locale in the pathname
    const segments = pathname.split('/')
    segments[1] = newLocale
    const newPath = segments.join('/')

    // Set cookie and navigate
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    router.push(newPath)
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-full p-1">
      <div className="flex items-center px-2 text-gray-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </div>
      <button
        onClick={() => handleLocaleChange('en')}
        className={`px-3 py-1 text-sm font-medium rounded-full transition-all duration-200 ${
          currentLocale === 'en'
            ? 'bg-white text-black shadow-sm'
            : 'text-gray-500 hover:text-black'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleLocaleChange('es')}
        className={`px-3 py-1 text-sm font-medium rounded-full transition-all duration-200 ${
          currentLocale === 'es'
            ? 'bg-white text-black shadow-sm'
            : 'text-gray-500 hover:text-black'
        }`}
      >
        ES
      </button>
    </div>
  )
}
