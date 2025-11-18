import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Load environment variables BEFORE anything else
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function seed() {
  console.log('🌱 Starting comprehensive database seed...')

  // Clean up old media files
  console.log('\n🗑️  Cleaning old media files...')
  const mediaDir = path.resolve(__dirname, '../media')
  if (fs.existsSync(mediaDir)) {
    const files = fs.readdirSync(mediaDir)
    const imageFiles = files.filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
    for (const file of imageFiles) {
      fs.unlinkSync(path.join(mediaDir, file))
    }
    console.log(`✅ Removed ${imageFiles.length} old media file(s)`)
  }

  // Dynamically import config after env vars are loaded
  const { getPayload } = await import('payload')
  const configModule = await import('../src/payload.config.js')
  const config = configModule.default

  const payload = await getPayload({ config })

  try {
    // ======================
    // 1. CREATE ADMIN USER
    // ======================
    console.log('\n📋 Step 1: Creating admin user...')
    const existingUsers = await payload.find({
      collection: 'users',
      limit: 1,
    })

    let adminUser
    if (existingUsers.docs.length === 0) {
      adminUser = await payload.create({
        collection: 'users',
        data: {
          email: 'admin@bozcocho.art',
          password: 'admin123',
          firstName: 'Admin',
          lastName: 'User',
        },
      })
      console.log('✅ Admin user created: admin@bozcocho.art / admin123')
    } else {
      adminUser = existingUsers.docs[0]
      console.log('ℹ️  Admin user already exists')
    }

    // ======================
    // 2. CREATE SAMPLE MEDIA
    // ======================
    console.log('\n📋 Step 2: Creating sample media...')

    // Helper function to fetch image from URL
    async function fetchImageFromUrl(url: string): Promise<Buffer> {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }

    const mediaFiles = [
      {
        filename: 'watercolor-class.jpg',
        url: 'https://picsum.photos/800/600',
        alt: {
          en: 'Watercolor class image',
          es: 'Imagen de clase de acuarela',
        },
        title: 'Watercolor Class',
      },
      {
        filename: 'acrylics-class.jpg',
        url: 'https://picsum.photos/800/600',
        alt: {
          en: 'Acrylics class image',
          es: 'Imagen de clase de acrílicos',
        },
        title: 'Acrylics Class',
      },
      {
        filename: 'portrait-class.jpg',
        url: 'https://picsum.photos/800/600',
        alt: {
          en: 'Portrait class image',
          es: 'Imagen de clase de retrato',
        },
        title: 'Portrait Class',
      },
      {
        filename: 'collage-class.jpg',
        url: 'https://picsum.photos/800/600',
        alt: {
          en: 'Collage class image',
          es: 'Imagen de clase de collage',
        },
        title: 'Collage Class',
      },
      {
        filename: 'instructor-maria.jpg',
        url: 'https://avatar.iran.liara.run/public/girl',
        alt: {
          en: 'María García photo',
          es: 'Foto de María García',
        },
        title: 'María García',
      },
      {
        filename: 'instructor-carlos.jpg',
        url: 'https://avatar.iran.liara.run/public/boy',
        alt: {
          en: 'Carlos Rodríguez photo',
          es: 'Foto de Carlos Rodríguez',
        },
        title: 'Carlos Rodríguez',
      },
    ]

    const createdMedia = []

    for (const { filename, url, alt, title } of mediaFiles) {
      try {
        console.log(`📥 Fetching image from ${url}...`)
        const imageBuffer = await fetchImageFromUrl(url)

        const media = await payload.create({
          collection: 'media',
          data: { alt: alt.en },
          file: {
            data: imageBuffer,
            mimetype: 'image/jpeg',
            name: filename,
            size: imageBuffer.length,
          },
          locale: 'en',
        })

        await payload.update({
          collection: 'media',
          id: media.id,
          data: { alt: alt.es },
          locale: 'es',
        })

        createdMedia.push(media)
        console.log(`✅ Created media: ${title}`)
      } catch (error) {
        console.error(`❌ Failed to create media ${title}:`, error)
      }
    }

    // ======================
    // 3. CREATE TAGS
    // ======================
    console.log('\n📋 Step 3: Creating tags...')

    const tagsData = [
      {
        name: { en: 'Kids & Family', es: 'Niños y Familia' },
        slug: 'kids-family',
        color: '#FF6B9D',
      },
      {
        name: { en: 'Wine', es: 'Vino' },
        slug: 'wine',
        color: '#9C27B0',
      },
      {
        name: { en: 'Ceramics - Painting', es: 'Cerámica - Pintura' },
        slug: 'ceramics-painting',
        color: '#8D6E63',
      },
      {
        name: { en: 'Ceramics - Hand Building', es: 'Cerámica - Construcción Manual' },
        slug: 'ceramics-hand-building',
        color: '#795548',
      },
      {
        name: { en: 'Painting', es: 'Pintura' },
        slug: 'painting',
        color: '#FF9800',
      },
    ]

    const createdTags = []
    for (const tagData of tagsData) {
      const tag = await payload.create({
        collection: 'tags',
        data: {
          name: tagData.name.en,
          slug: tagData.slug,
          color: tagData.color,
        },
        locale: 'en',
      })

      await payload.update({
        collection: 'tags',
        id: tag.id,
        data: {
          name: tagData.name.es,
        },
        locale: 'es',
      })

      createdTags.push(tag)
      console.log(`✅ Created tag: ${tagData.name.en}`)
    }

    // ======================
    // 4. CREATE INSTRUCTORS
    // ======================
    console.log('\n📋 Step 4: Creating instructors...')

    const instructors = [
      {
        name: 'María García',
        slug: 'maria-garcia',
        bio: {
          en: 'Professional watercolor artist with 15 years of teaching experience. Specializes in landscapes and botanical art.',
          es: 'Artista profesional de acuarela con 15 años de experiencia docente. Se especializa en paisajes y arte botánico.',
        },
        email: 'maria@bozchocho.art',
        phone: '+34 612 345 678',
        specialties: {
          en: 'Watercolor, Botanical Art, Landscapes',
          es: 'Acuarela, Arte Botánico, Paisajes',
        },
        photo: createdMedia[4]?.id, // instructor-maria.jpg
        isActive: true,
      },
      {
        name: 'Carlos Rodríguez',
        slug: 'carlos-rodriguez',
        bio: {
          en: 'Contemporary artist and instructor focusing on abstract techniques and modern art. Exhibited internationally.',
          es: 'Artista e instructor contemporáneo enfocado en técnicas abstractas y arte moderno. Ha expuesto internacionalmente.',
        },
        email: 'carlos@bozchocho.art',
        phone: '+34 623 456 789',
        specialties: {
          en: 'Abstract Art, Acrylics, Mixed Media',
          es: 'Arte Abstracto, Acrílicos, Técnica Mixta',
        },
        photo: createdMedia[5]?.id, // instructor-carlos.jpg
        isActive: true,
      },
    ]

    const createdInstructors = []
    for (const instructorData of instructors) {
      const instructor = await payload.create({
        collection: 'instructors',
        data: {
          name: instructorData.name,
          slug: instructorData.slug,
          bio: instructorData.bio.en,
          email: instructorData.email,
          phone: instructorData.phone,
          specialties: instructorData.specialties.en,
          photo: instructorData.photo,
          isActive: instructorData.isActive,
        },
        locale: 'en',
      })

      await payload.update({
        collection: 'instructors',
        id: instructor.id,
        data: {
          bio: instructorData.bio.es,
          specialties: instructorData.specialties.es,
        },
        locale: 'es',
      })

      createdInstructors.push(instructor)
      console.log(`✅ Created instructor: ${instructorData.name}`)
    }

    // ======================
    // 4. CLEAR OLD CLASSES
    // ======================
    console.log('\n📋 Step 4: Clearing old data...')

    const oldClasses = await payload.find({ collection: 'class-templates', limit: 100 })
    for (const cls of oldClasses.docs) {
      await payload.delete({ collection: 'class-templates', id: cls.id })
    }
    console.log(`🗑️  Deleted ${oldClasses.docs.length} old class templates`)

    // ======================
    // 5. CREATE ONE-TIME CLASSES
    // ======================
    console.log('\n📋 Step 5: Creating one-time classes...')

    const oneTimeClasses = [
      {
        title: { en: 'Watercolor Basics', es: 'Fundamentos de Acuarela' },
        slug: { en: 'watercolor-basics', es: 'fundamentos-acuarela' },
        description: {
          en: 'Learn the fundamentals of watercolor painting in this beginner-friendly class.',
          es: 'Aprende los fundamentos de la pintura con acuarela en esta clase para principiantes.',
        },
        classType: 'one-time',
        instructor: createdInstructors[0].id,
        featuredImage: createdMedia[0]?.id,
        priceCents: 4500,
        currency: 'eur',
        durationMinutes: 180,
        maxCapacity: 8,
        location: { en: 'Studio A', es: 'Estudio A' },
        tags: [createdTags[4].id], // Painting
        isPublished: true,
      },
      {
        title: { en: 'Abstract Acrylics Workshop', es: 'Taller de Acrílicos Abstractos' },
        slug: { en: 'abstract-acrylics', es: 'acrilicos-abstractos' },
        description: {
          en: 'Unleash your creativity with abstract acrylic painting techniques.',
          es: 'Libera tu creatividad con técnicas de pintura acrílica abstracta.',
        },
        classType: 'one-time',
        instructor: createdInstructors[1].id,
        featuredImage: createdMedia[1]?.id,
        priceCents: 5500,
        currency: 'eur',
        durationMinutes: 180,
        maxCapacity: 6,
        location: { en: 'Studio B', es: 'Estudio B' },
        tags: [createdTags[4].id], // Painting
        isPublished: true,
      },
    ]

    const createdOneTimeClasses = []
    for (const classData of oneTimeClasses) {
      const cls = await payload.create({
        collection: 'class-templates',
        data: {
          title: classData.title.en,
          slug: classData.slug.en,
          description: classData.description.en,
          classType: classData.classType as 'one-time' | 'recurring' | 'membership-template',
          instructor: classData.instructor,
          featuredImage: classData.featuredImage,
          priceCents: classData.priceCents,
          currency: classData.currency,
          durationMinutes: classData.durationMinutes,
          maxCapacity: classData.maxCapacity,
          location: classData.location.en,
          tags: classData.tags,
          isPublished: classData.isPublished,
        },
        locale: 'en',
      })

      await payload.update({
        collection: 'class-templates',
        id: cls.id,
        data: {
          title: classData.title.es,
          slug: classData.slug.es,
          description: classData.description.es,
          location: classData.location.es,
        },
        locale: 'es',
      })

      createdOneTimeClasses.push(cls)
      console.log(`✅ Created one-time class: ${classData.title.en}`)

      // Create class instance for this one-time class
      const instanceStart = new Date('2025-12-15T14:00:00Z')
      const instanceEnd = new Date(instanceStart.getTime() + classData.durationMinutes * 60000)

      const instance = await payload.create({
        collection: 'class-sessions',
        data: {
          classTemplate: cls.id,
          startDateTime: instanceStart.toISOString(),
          endDateTime: instanceEnd.toISOString(),
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          availableSpots: classData.maxCapacity,
        },
      })
      console.log(`  📅 Created instance for ${new Date(instanceStart).toLocaleString('es-ES')}`)
    }

    // ======================
    // 6. CREATE RECURRING CLASS
    // ======================
    console.log('\n📋 Step 6: Creating recurring class...')

    const recurringClass = await payload.create({
      collection: 'class-templates',
      data: {
        title: 'Paint & Drink Wine',
        slug: 'paint-drink-wine',
        description:
          'Relax and paint while enjoying a glass of wine. Perfect for unwinding after work!',
        classType: 'recurring',
        instructor: createdInstructors[1].id,
        featuredImage: createdMedia[1]?.id,
        priceCents: 3500,
        currency: 'eur',
        durationMinutes: 120,
        maxCapacity: 12,
        location: 'Wine Bar Studio',
        tags: [createdTags[1].id, createdTags[4].id], // Wine + Painting
        isPublished: true,
      },
      locale: 'en',
    })

    await payload.update({
      collection: 'class-templates',
      id: recurringClass.id,
      data: {
        title: 'Pintar y Beber Vino',
        slug: 'pintar-beber-vino',
        description:
          '¡Relájate y pinta mientras disfrutas de una copa de vino! ¡Perfecto para relajarse después del trabajo!',
        location: 'Estudio del Bar de Vinos',
      },
      locale: 'es',
    })

    console.log(`✅ Created recurring class: Paint & Drink Wine`)

    // Add recurrence pattern as array field (every Thursday at 18:00)
    await payload.update({
      collection: 'class-templates',
      id: recurringClass.id,
      data: {
        recurrencePatterns: [
          {
            frequency: 'weekly',
            daysOfWeek: ['4'], // Thursday
            startTime: '18:00',
            startDate: new Date('2025-12-01').toISOString(),
            endDate: new Date('2026-02-28').toISOString(),
            timezone: 'Europe/Madrid',
            isActive: true,
          },
        ],
      },
    })

    console.log(`  🔁 Added recurrence pattern: Every Thursday at 18:00`)

    // Generate instances for next 4 weeks
    const thursdays = []
    const patternStart = new Date('2025-12-04') // First Thursday in December
    for (let i = 0; i < 8; i++) {
      const thursday = new Date(patternStart)
      thursday.setDate(thursday.getDate() + i * 7)
      thursday.setHours(18, 0, 0, 0)
      thursdays.push(thursday)
    }

    for (const thursday of thursdays) {
      const instanceEnd = new Date(thursday.getTime() + 120 * 60000)
      await payload.create({
        collection: 'class-sessions',
        data: {
          classTemplate: recurringClass.id,
          startDateTime: thursday.toISOString(),
          endDateTime: instanceEnd.toISOString(),
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          availableSpots: 12,
        },
      })
    }
    console.log(`  📅 Generated ${thursdays.length} recurring instances`)

    // ======================
    // 7. CREATE COURSE
    // ======================
    console.log('\n📋 Step 7: Creating course...')

    const courseTemplate = await payload.create({
      collection: 'class-templates',
      data: {
        title: 'Ceramics Techniques',
        slug: 'ceramics-techniques',
        description: 'Learn hand-building, wheel throwing, and glazing techniques.',
        classType: 'membership-template',
        instructor: createdInstructors[0].id,
        featuredImage: createdMedia[2]?.id,
        priceCents: 3000,
        currency: 'eur',
        durationMinutes: 120,
        maxCapacity: 10,
        location: 'Ceramics Studio',
        tags: [createdTags[3].id], // Ceramics - Hand Building
        isPublished: true,
      },
      locale: 'en',
    })

    await payload.update({
      collection: 'class-templates',
      id: courseTemplate.id,
      data: {
        title: 'Técnicas de Cerámica',
        slug: 'tecnicas-ceramica',
        description: 'Aprende técnicas de construcción manual, torno y esmaltado.',
        location: 'Estudio de Cerámica',
      },
      locale: 'es',
    })

    console.log(`✅ Created membership template: Ceramics Techniques`)

    const membership = await payload.create({
      collection: 'memberships',
      data: {
        title: 'Ceramics for Novices - Monthly Membership',
        slug: 'ceramics-novices-monthly',
        description:
          'Monthly subscription giving access to ceramics classes every Tuesday and Wednesday at 20:00.',
        classTemplates: [courseTemplate.id],
        featuredImage: createdMedia[2]?.id,
        monthlyPriceCents: 12000,
        currency: 'eur',
        billingCycle: 'monthly',
        maxEnrollments: 10,
        tags: [createdTags[3].id], // Ceramics - Hand Building
        isPublished: true,
      },
      locale: 'en',
    })

    await payload.update({
      collection: 'memberships',
      id: membership.id,
      data: {
        title: 'Cerámica para Principiantes - Membresía Mensual',
        slug: 'ceramica-principiantes-mensual',
        description:
          'Suscripción mensual que da acceso a clases de cerámica todos los martes y miércoles a las 20:00.',
      },
      locale: 'es',
    })

    console.log(`✅ Created membership: Ceramics for Novices`)

    // Generate membership sessions (Tuesdays and Wednesdays at 20:00 for December)
    const membershipSessions = []
    const membershipStart = new Date('2025-12-02') // First Tuesday in December

    for (let day = 0; day < 31; day++) {
      const date = new Date(membershipStart)
      date.setDate(date.getDate() + day)
      const dayOfWeek = date.getDay()

      // Tuesday (2) or Wednesday (3)
      if (dayOfWeek === 2 || dayOfWeek === 3) {
        date.setHours(20, 0, 0, 0)
        const instanceEnd = new Date(date.getTime() + 120 * 60000)

        const instance = await payload.create({
          collection: 'class-sessions',
          data: {
            classTemplate: courseTemplate.id,
            startDateTime: date.toISOString(),
            endDateTime: instanceEnd.toISOString(),
            timezone: 'Europe/Madrid',
            status: 'scheduled',
            availableSpots: 10,
          },
        })
        membershipSessions.push(instance)
      }
    }

    console.log(`  📅 Generated ${membershipSessions.length} membership sessions`)

    // Create membership schedule
    await payload.create({
      collection: 'membership-schedules',
      data: {
        membership: membership.id,
        classSessions: membershipSessions.map((i) => i.id),
        startDate: new Date('2025-12-01').toISOString(),
        endDate: new Date('2025-12-31').toISOString(),
        isActive: true,
      },
    })

    console.log(`  📋 Created membership schedule`)

    console.log('\n🎉 Comprehensive seed completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`  ✓ 1 Admin user`)
    console.log(`  ✓ ${createdMedia.length} Media files`)
    console.log(`  ✓ ${createdInstructors.length} Instructors`)
    console.log(`  ✓ ${createdOneTimeClasses.length} One-time class templates`)
    console.log(`  ✓ 1 Recurring class template (Paint & Drink Wine - Thursdays)`)
    console.log(`  ✓ 1 Membership (Ceramics - Tue & Wed)`)
    console.log('\nYou can now:')
    console.log('  1. Visit http://localhost:4321/admin')
    console.log('  2. Login with: admin@bozcocho.art / admin123')
    console.log('  3. Explore Class Templates, Instructors, Class Sessions, Memberships, etc.')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
