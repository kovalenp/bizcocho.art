import { Heading, Img, Section } from '@react-email/components'

// Get asset base URL from R2 or fallback to production
const getAssetBaseUrl = () => process.env.R2_PUBLIC_URL || 'https://assets.bizcocho.art'

interface HeaderProps {
  title: string
  accentColor?: string
  assetBaseUrl?: string
}

export function Header({ title, accentColor = '#000000', assetBaseUrl }: HeaderProps) {
  const baseUrl = assetBaseUrl || getAssetBaseUrl()

  return (
    <Section className="text-center mb-10 pb-8 border-b border-gray-200">
      <Img
        src={`${baseUrl}/logo.png`}
        width="140"
        height="48"
        alt="bizcocho.art"
        className="mx-auto mb-6"
      />
      <Heading
        as="h1"
        className="m-0 text-2xl font-bold tracking-tight"
        style={{ color: accentColor }}
      >
        {title}
      </Heading>
    </Section>
  )
}
