import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tags } from './collections/Tags'
import { Classes } from './collections/Classes'
import { Instructors } from './collections/Instructors'
import { Sessions } from './collections/Sessions'
import { Bookings } from './collections/Bookings'
import { GiftCertificates } from './collections/GiftCertificates'
import { logger } from './lib/logger'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Configure S3/R2 storage for production environments.
 * In development, files are stored locally in /media.
 * In production, files are stored in Cloudflare R2.
 */
const getStoragePlugins = () => {
  // Skip R2 if not configured (works in both dev and prod when credentials are set)
  if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
    return []
  }

  return [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          disableLocalStorage: true,
          generateFileURL: ({ filename, prefix }) => {
            const baseUrl =
              process.env.R2_PUBLIC_URL ||
              `https://${process.env.R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            return `${baseUrl}/${prefix}/${filename}`
          },
        },
      },
      bucket: process.env.R2_BUCKET!,
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: 'auto', // R2 uses 'auto' for region
      },
    }),
  ]
}

export default buildConfig({
  serverURL: process.env.SITE_URL || 'http://localhost:4321',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Tags, Classes, Instructors, Sessions, Bookings, GiftCertificates],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  localization: {
    locales: [
      {
        code: 'en',
        label: 'English',
      },
      {
        code: 'es',
        label: 'Español',
      },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  sharp,
  logger,
  plugins: [...getStoragePlugins()],
})
