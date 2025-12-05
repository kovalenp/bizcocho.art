/**
 * Minimal seed script for test/production environments.
 * Creates only the database schema and an admin user.
 *
 * Usage:
 *   DATABASE_URI="postgresql://..." pnpm seed:admin
 *
 * To drop existing data first:
 *   DATABASE_URI="postgresql://..." PAYLOAD_DROP_DATABASE=true pnpm seed:admin
 *
 * Or locally:
 *   pnpm seed:admin
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables BEFORE anything else
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Check if we should drop the database
if (process.env.PAYLOAD_DROP_DATABASE === 'true') {
  console.log('PAYLOAD_DROP_DATABASE=true - will drop existing tables')
}

async function seedAdmin() {
  console.log('Starting minimal seed (schema + admin user)...')

  // Dynamically import config after env vars are loaded
  const { getPayload } = await import('payload')
  const configModule = await import('../src/payload.config.js')
  const config = configModule.default

  const payload = await getPayload({ config })

  try {
    // Check if admin user already exists
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existingUsers.docs.length > 0) {
      console.log('Admin user already exists, skipping creation')
      console.log('\nDone! Schema is ready.')
      process.exit(0)
    }

    // Create admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bizcocho.art'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
      },
    })

    console.log(`Admin user created: ${adminEmail}`)
    console.log('\nDone! Schema is ready and admin user created.')
    console.log(`Login at: ${process.env.SITE_URL || 'http://localhost:4321'}/admin`)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }

  process.exit(0)
}

seedAdmin()
