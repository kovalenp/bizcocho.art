'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { type Locale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'
import { LanguageSelector } from './LanguageSelector'

type NavigationProps = {
  currentLocale: Locale
  messages: Messages
}

export function Navigation({ currentLocale, messages }: NavigationProps) {
  const pathname = usePathname()

  const navItems = [
    { href: `/${currentLocale}`, label: messages.nav.events },
    { href: `/${currentLocale}/gift-certificates`, label: messages.nav.giftCertificates },
    { href: `/${currentLocale}/about`, label: messages.nav.about },
  ]

  const isActive = (href: string) => {
    if (href === `/${currentLocale}`) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-white sticky top-0 z-50 backdrop-blur-sm bg-white/95 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo - Left side */}
          <Link
            href={`/${currentLocale}`}
            className="flex items-center transition-transform duration-300 hover:scale-105"
          >
            <Image
              src="/logo.png"
              alt="bizcocho.art"
              width={120}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </Link>

          {/* Navigation Links - Center */}
          <div className="hidden md:flex items-center justify-center flex-1 space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full ${
                  isActive(item.href)
                    ? 'bg-gray-100 text-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Language Selector - Right side */}
          <div className="hidden md:flex items-center">
            <LanguageSelector currentLocale={currentLocale} />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <LanguageSelector currentLocale={currentLocale} />
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-all duration-200"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6 transition-transform duration-200 hover:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu - Hidden by default */}
        {/* TODO: Add mobile menu toggle functionality */}
      </div>
    </nav>
  )
}
