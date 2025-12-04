import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
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

export default buildConfig({
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
  plugins: [],
})
