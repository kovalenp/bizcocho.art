import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Load environment variables BEFORE anything else
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function seed() {
  console.log('🌱 Starting database seed...')

  // Dynamically import config after env vars are loaded
  const { getPayload } = await import('payload')
  const configModule = await import('../src/payload.config.js')
  const config = configModule.default

  const payload = await getPayload({ config })

  try {
    // Create admin user if it doesn't exist
    console.log('Creating admin user...')
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existingUsers.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: 'admin@bozchocho.art',
          password: 'admin123',
        },
      })
      console.log('✅ Admin user created: admin@bozchocho.art / admin123')
    } else {
      console.log('ℹ️  Admin user already exists')
    }

    // Create sample media
    console.log('\nCreating sample media...')

    // Path to media folder with real images
    const mediaDir = path.resolve(__dirname, '../media')

    const mediaFiles = [
      {
        filename: 'watercolor-class.jpg',
        alt: {
          en: 'Watercolor class image',
          es: 'Imagen de clase de acuarela'
        },
        title: 'Watercolor'
      },
      {
        filename: 'acrylics-class.jpg',
        alt: {
          en: 'Acrylics class image',
          es: 'Imagen de clase de acrílicos'
        },
        title: 'Acrylics'
      },
      {
        filename: 'portrait-class.jpg',
        alt: {
          en: 'Portrait class image',
          es: 'Imagen de clase de retrato'
        },
        title: 'Portrait'
      },
      {
        filename: 'collage-class.jpg',
        alt: {
          en: 'Collage class image',
          es: 'Imagen de clase de collage'
        },
        title: 'Collage'
      },
    ]

    // Check if media already exists, don't delete existing media
    const existingMedia = await payload.find({
      collection: 'media',
      limit: 100,
    })

    const createdMedia = [...existingMedia.docs]

    // Only create media if it doesn't already exist
    for (const { filename, alt, title } of mediaFiles) {
      // Check if this media already exists by checking filename in existing media
      const alreadyExists = existingMedia.docs.some(
        (doc: any) => doc.filename === filename
      )

      if (alreadyExists) {
        console.log(`ℹ️  Media already exists: ${title}`)
        continue
      }

      const imagePath = path.join(mediaDir, filename)

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.log(`⚠️  Warning: ${filename} not found, skipping...`)
        continue
      }

      const imageBuffer = fs.readFileSync(imagePath)

      // Create media with English alt text first
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: alt.en,
        },
        file: {
          data: imageBuffer,
          mimetype: 'image/jpeg',
          name: filename,
          size: imageBuffer.length,
        },
        locale: 'en',
      })

      // Update with Spanish alt text
      await payload.update({
        collection: 'media',
        id: media.id,
        data: {
          alt: alt.es,
        },
        locale: 'es',
      })

      createdMedia.push(media)
      console.log(`✅ Created media: ${title}`)
    }

    // Create sample classes
    console.log('\nCreating sample classes...')

    const sampleClasses = [
      {
        title: {
          en: 'Watercolor Basics',
          es: 'Fundamentos de Acuarela',
        },
        slug: {
          en: 'watercolor-basics',
          es: 'fundamentos-acuarela',
        },
        description: {
          en: 'Learn the fundamentals of watercolor painting in this beginner-friendly class. Explore color mixing, brush techniques, and create beautiful landscapes.',
          es: 'Aprende los fundamentos de la pintura con acuarela en esta clase para principiantes. Explora la mezcla de colores, técnicas de pincel y crea hermosos paisajes.',
        },
        priceCents: 4500, // €45.00
        currency: 'eur',
        capacity: 8,
        start: new Date('2025-11-15T14:00:00'),
        end: new Date('2025-11-15T17:00:00'),
        isPublished: true,
        featuredImage: createdMedia[0]?.id,
      },
      {
        title: {
          en: 'Abstract Acrylics',
          es: 'Acrílicos Abstractos',
        },
        slug: {
          en: 'abstract-acrylics',
          es: 'acrilicos-abstractos',
        },
        description: {
          en: 'Unleash your creativity with abstract acrylic painting. Learn composition, color theory, and expressive techniques to create stunning modern art.',
          es: 'Libera tu creatividad con pintura acrílica abstracta. Aprende composición, teoría del color y técnicas expresivas para crear arte moderno impresionante.',
        },
        priceCents: 5500, // €55.00
        currency: 'eur',
        capacity: 6,
        start: new Date('2025-11-20T18:00:00'),
        end: new Date('2025-11-20T21:00:00'),
        isPublished: true,
        featuredImage: createdMedia[1]?.id,
      },
      {
        title: {
          en: 'Portrait Drawing',
          es: 'Dibujo de Retrato',
        },
        slug: {
          en: 'portrait-drawing',
          es: 'dibujo-retrato',
        },
        description: {
          en: 'Master the art of portrait drawing with pencil and charcoal. Study proportions, shading techniques, and capturing likeness.',
          es: 'Domina el arte del dibujo de retrato con lápiz y carboncillo. Estudia proporciones, técnicas de sombreado y captura de semejanza.',
        },
        priceCents: 6000, // €60.00
        currency: 'eur',
        capacity: 10,
        start: new Date('2025-11-25T10:00:00'),
        end: new Date('2025-11-25T13:00:00'),
        isPublished: true,
        featuredImage: createdMedia[2]?.id,
      },
      {
        title: {
          en: 'Mixed Media Collage',
          es: 'Collage de Técnica Mixta',
        },
        slug: {
          en: 'mixed-media-collage',
          es: 'collage-tecnica-mixta',
        },
        description: {
          en: 'Explore the world of mixed media art. Combine papers, fabrics, paints, and found objects to create unique textured artwork.',
          es: 'Explora el mundo del arte de técnica mixta. Combina papeles, telas, pinturas y objetos encontrados para crear obras de arte texturizadas únicas.',
        },
        priceCents: 5000, // €50.00
        currency: 'eur',
        capacity: 8,
        start: new Date('2025-12-01T14:00:00'),
        end: new Date('2025-12-01T17:00:00'),
        isPublished: true,
        featuredImage: createdMedia[3]?.id,
      },
    ]

    // Clear existing classes
    const existingClasses = await payload.find({
      collection: 'classes',
      limit: 100,
    })

    for (const cls of existingClasses.docs) {
      await payload.delete({
        collection: 'classes',
        id: cls.id,
      })
    }
    console.log(`🗑️  Deleted ${existingClasses.docs.length} existing classes`)

    // Create new classes - need to create once per locale
    for (const classData of sampleClasses) {
      // Create with English data first
      const createdClass = await payload.create({
        collection: 'classes',
        data: {
          title: classData.title.en,
          slug: classData.slug.en,
          description: classData.description.en,
          priceCents: classData.priceCents,
          currency: classData.currency,
          capacity: classData.capacity,
          start: classData.start.toISOString(),
          end: classData.end.toISOString(),
          isPublished: classData.isPublished,
          featuredImage: classData.featuredImage,
        },
        locale: 'en',
      })

      // Update with Spanish translation
      await payload.update({
        collection: 'classes',
        id: createdClass.id,
        data: {
          title: classData.title.es,
          slug: classData.slug.es,
          description: classData.description.es,
        },
        locale: 'es',
      })

      console.log(`✅ Created class: ${classData.title.en} / ${classData.title.es}`)
    }

    console.log('\n🎉 Seed completed successfully!')
    console.log('\nYou can now:')
    console.log('  1. Visit http://localhost:4321/admin to manage content')
    console.log('  2. Login with: admin@bozchocho.art / admin123')
    console.log('  3. View classes at http://localhost:4321\n')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
