import { Button as EmailButton } from '@react-email/components'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const className =
    variant === 'primary'
      ? 'inline-block px-6 py-3 rounded-lg text-sm font-semibold no-underline text-center bg-black text-white'
      : 'inline-block px-6 py-3 rounded-lg text-sm font-semibold no-underline text-center bg-gray-100 text-gray-700 border border-gray-300'

  return (
    <EmailButton href={href} className={className}>
      {children}
    </EmailButton>
  )
}
