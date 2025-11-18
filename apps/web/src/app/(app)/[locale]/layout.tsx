import { locales, type Locale } from '@/i18n/config'

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

  return (
    <div lang={locale} className="min-h-screen">
      {children}
    </div>
  )
}
