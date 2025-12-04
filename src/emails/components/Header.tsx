import { Heading, Img, Section } from '@react-email/components'

interface HeaderProps {
  title: string
  accentColor?: string
}

export function Header({ title, accentColor = '#000000' }: HeaderProps) {
  return (
    <Section className="text-center mb-10 pb-8 border-b border-gray-200">
      <Img
        src="https://bizcocho.art/logo.png"
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
