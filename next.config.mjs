import { withPayload } from '@payloadcms/next/withPayload'

// Build remote patterns dynamically from environment variables
const buildRemotePatterns = () => {
  const patterns = [
    // Local development
    {
      protocol: 'http',
      hostname: 'localhost',
      port: '4321',
      pathname: '/api/media/file/**',
    },
    // R2 assets - hardcoded fallback
    {
      protocol: 'https',
      hostname: 'assets-test.bizcocho.art',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'assets.bizcocho.art',
      pathname: '/**',
    },
  ]

  // Add SITE_URL domain (e.g., bizcocho.art or test.bizcocho.art)
  if (process.env.SITE_URL) {
    try {
      const siteUrl = new URL(process.env.SITE_URL)
      patterns.push({
        protocol: siteUrl.protocol.replace(':', ''),
        hostname: siteUrl.hostname,
        pathname: '/api/media/file/**',
      })
    } catch {
      // Invalid URL, skip
    }
  }

  // Add R2 assets domain (e.g., assets.bizcocho.art or assets-test.bizcocho.art)
  if (process.env.R2_PUBLIC_URL) {
    try {
      const r2Url = new URL(process.env.R2_PUBLIC_URL)
      patterns.push({
        protocol: r2Url.protocol.replace(':', ''),
        hostname: r2Url.hostname,
        pathname: '/**',
      })
    } catch {
      // Invalid URL, skip
    }
  }

  return patterns
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  poweredByHeader: false,

  // Standalone output for Docker deployment
  output: 'standalone',

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: buildRemotePatterns(),
  },

  // Compression
  compress: true,

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Fix thread-stream worker path issue with pino
    if (isServer) {
      webpackConfig.externals = webpackConfig.externals || []
      webpackConfig.externals.push('pino', 'pino-pretty', 'thread-stream')
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
