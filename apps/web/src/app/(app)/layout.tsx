import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bizcocho.art',
  description: 'Discover your creativity through art classes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
