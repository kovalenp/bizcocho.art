import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bozchocho.art',
  description: 'Discover your creativity through art classes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
