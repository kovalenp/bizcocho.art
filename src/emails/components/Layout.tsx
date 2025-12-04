import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Locale } from '../../i18n/config'

interface LayoutProps {
  children: React.ReactNode
  preview: string
  title: string
  footerMessage?: string
  locale?: Locale
  accentColor?: string
}

// Font hosted at bizcocho.art
const FONT_URL = 'https://bizcocho.art/fonts/LabilGrotesk-50Regular.woff2'
const FONT_BOLD_URL = 'https://bizcocho.art/fonts/LabilGrotesk-70Bold.woff2'

export function Layout({
  children,
  preview,
  title,
  footerMessage,
  locale = 'en',
  accentColor,
}: LayoutProps) {
  return (
    <Html lang={locale}>
      <Head>
        <Font
          fontFamily="Labil Grotesk"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: FONT_URL,
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Labil Grotesk"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: FONT_BOLD_URL,
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans m-0 py-10 px-5">
          <Container className="max-w-[560px] mx-auto">
            <Header title={title} accentColor={accentColor} />
            <Section className="mb-8">{children}</Section>
            <Footer message={footerMessage} locale={locale} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
