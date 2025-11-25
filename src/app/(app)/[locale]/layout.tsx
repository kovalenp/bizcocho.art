import { locales, type Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import { Navigation } from '@/components/ui/Navigation'

type Props = {
  children: React.ReactNode
  params: Promise<{
    locale: Locale
  }>
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  const messages = getMessages(locale)

  return (
    <div lang={locale} className="min-h-screen bg-white">
      <Navigation currentLocale={locale} messages={messages} />
      <main>{children}</main>
    </div>
  )
}
