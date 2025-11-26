import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Load environment variables BEFORE anything else
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Always drop database before seeding to ensure clean state
process.env.PAYLOAD_DROP_DATABASE = 'true'

async function seed() {
  console.log('🌱 Starting comprehensive database seed...')

  const mediaDir = path.resolve(__dirname, '../media')

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
          email: 'admin@bizcocho.art',
          password: 'admin123',
          firstName: 'Admin',
          lastName: 'User',
        },
      })
      console.log('✅ Admin user created: admin@bizcocho.art / admin123')
    } else {
      adminUser = existingUsers.docs[0]
      console.log('ℹ️  Admin user already exists')
    }

    // ======================
    // 2. CREATE SAMPLE MEDIA
    // ======================
    console.log('\n📋 Step 2: Creating sample media...')

    // Media file definitions
    const mediaFiles = [
      {
        filename: 'ceramic-pot.jpg',
        url: 'https://picsum.photos/800/600?random=1',
        alt: { en: 'Ceramic pot painting class', es: 'Clase de pintura de cerámica' },
        title: 'Ceramic Pot Class',
      },
      {
        filename: 'wheel-throwing.jpg',
        url: 'https://picsum.photos/800/600?random=2',
        alt: { en: 'Wheel throwing class', es: 'Clase de torno' },
        title: 'Wheel Throwing Class',
      },
      {
        filename: 'hand-building.jpg',
        url: 'https://picsum.photos/800/600?random=3',
        alt: { en: 'Hand building class', es: 'Clase de construcción manual' },
        title: 'Hand Building Class',
      },
      {
        filename: 'glazing-class.jpg',
        url: 'https://picsum.photos/800/600?random=4',
        alt: { en: 'Glazing techniques class', es: 'Clase de técnicas de esmaltado' },
        title: 'Glazing Class',
      },
      {
        filename: 'gallery-1.jpg',
        url: 'https://picsum.photos/800/600?random=5',
        alt: { en: 'Studio gallery 1', es: 'Galería del estudio 1' },
        title: 'Gallery Image 1',
      },
      {
        filename: 'gallery-2.jpg',
        url: 'https://picsum.photos/800/600?random=6',
        alt: { en: 'Studio gallery 2', es: 'Galería del estudio 2' },
        title: 'Gallery Image 2',
      },
      {
        filename: 'gallery-3.jpg',
        url: 'https://picsum.photos/800/600?random=7',
        alt: { en: 'Studio gallery 3', es: 'Galería del estudio 3' },
        title: 'Gallery Image 3',
      },
      {
        filename: 'instructor-elena.jpg',
        url: 'https://i.pravatar.cc/300?img=5', // Woman avatar
        alt: { en: 'Elena Martínez photo', es: 'Foto de Elena Martínez' },
        title: 'Elena Martínez',
      },
      {
        filename: 'instructor-pablo.jpg',
        url: 'https://i.pravatar.cc/300?img=12', // Man avatar
        alt: { en: 'Pablo Sánchez photo', es: 'Foto de Pablo Sánchez' },
        title: 'Pablo Sánchez',
      },
    ]

    // Check if media directory has existing images
    let existingImages: string[] = []
    if (fs.existsSync(mediaDir)) {
      existingImages = fs.readdirSync(mediaDir).filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
    } else {
      fs.mkdirSync(mediaDir, { recursive: true })
    }

    const shouldDownloadImages = existingImages.length === 0

    // Helper function to fetch image from URL
    async function fetchImageFromUrl(url: string): Promise<Buffer> {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }

    const createdMedia: any[] = []

    if (shouldDownloadImages) {
      console.log('📥 Media directory empty, downloading images...')

      for (const { filename, url, alt, title } of mediaFiles) {
        try {
          console.log(`  📥 Fetching: ${title}...`)
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
          console.log(`  ✅ Created: ${title}`)
        } catch (error) {
          console.error(`  ❌ Failed to create ${title}:`, error)
        }
      }
    } else {
      console.log(`📁 Found ${existingImages.length} existing images, reusing them...`)

      for (const { filename, alt, title } of mediaFiles) {
        try {
          // Find existing file by name pattern (e.g., "ceramic-pot" in "ceramic-pot-abc123.jpg")
          const baseFilename = filename.replace('.jpg', '')
          const existingFile = existingImages.find((f) => f.includes(baseFilename))

          if (existingFile) {
            const filePath = path.join(mediaDir, existingFile)
            const imageBuffer = fs.readFileSync(filePath)

            const media = await payload.create({
              collection: 'media',
              data: { alt: alt.en },
              file: {
                data: imageBuffer,
                mimetype: 'image/jpeg',
                name: existingFile,
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
            console.log(`  ✅ Reused: ${title} (${existingFile})`)
          } else {
            // File doesn't exist locally, download it
            console.log(`  📥 Downloading missing: ${title}...`)
            const fileConfig = mediaFiles.find((m) => m.filename === filename)
            if (fileConfig) {
              const imageBuffer = await fetchImageFromUrl(fileConfig.url)

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
              console.log(`  ✅ Downloaded: ${title}`)
            }
          }
        } catch (error) {
          console.error(`  ❌ Failed to create ${title}:`, error)
        }
      }
    }

    console.log(`✅ Created ${createdMedia.length} media files`)

    // ======================
    // 3. CREATE TAGS
    // ======================
    console.log('\n📋 Step 3: Creating tags...')

    const tagsData = [
      { name: { en: 'Kids & Family', es: 'Niños y Familia' }, slug: 'kids-family', color: '#FF6B9D' },
      { name: { en: 'Wine & Paint', es: 'Vino y Pintura' }, slug: 'wine-paint', color: '#9C27B0' },
      { name: { en: 'Ceramics', es: 'Cerámica' }, slug: 'ceramics', color: '#8D6E63' },
      { name: { en: 'Wheel Throwing', es: 'Torno' }, slug: 'wheel-throwing', color: '#795548' },
      { name: { en: 'Hand Building', es: 'Construcción Manual' }, slug: 'hand-building', color: '#A1887F' },
      { name: { en: 'Courses', es: 'Cursos' }, slug: 'courses', color: '#3B82F6' },
    ]

    const createdTags: any[] = []
    for (const tagData of tagsData) {
      const tag = await payload.create({
        collection: 'tags',
        data: { name: tagData.name.en, slug: tagData.slug, color: tagData.color },
        locale: 'en',
      })

      await payload.update({
        collection: 'tags',
        id: tag.id,
        data: { name: tagData.name.es },
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
        name: 'Elena Martínez',
        slug: 'elena-martinez',
        bio: {
          en: 'Master ceramicist with 20 years of experience. Specializes in wheel throwing and traditional Spanish pottery techniques.',
          es: 'Ceramista maestra con 20 años de experiencia. Se especializa en torno y técnicas tradicionales de cerámica española.',
        },
        email: 'elena@bizcocho.art',
        phone: '+34 612 345 678',
        specialties: { en: 'Wheel Throwing, Glazing, Spanish Pottery', es: 'Torno, Esmaltado, Cerámica Española' },
        photo: createdMedia[7]?.id,
        isActive: true,
      },
      {
        name: 'Pablo Sánchez',
        slug: 'pablo-sanchez',
        bio: {
          en: 'Contemporary ceramic artist focusing on hand-building and sculptural pieces. Has exhibited in galleries across Europe.',
          es: 'Artista cerámico contemporáneo enfocado en construcción manual y piezas escultóricas. Ha expuesto en galerías de toda Europa.',
        },
        email: 'pablo@bizcocho.art',
        phone: '+34 623 456 789',
        specialties: { en: 'Hand Building, Sculpture, Contemporary Ceramics', es: 'Construcción Manual, Escultura, Cerámica Contemporánea' },
        photo: createdMedia[8]?.id,
        isActive: true,
      },
    ]

    const createdInstructors: any[] = []
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
        data: { bio: instructorData.bio.es, specialties: instructorData.specialties.es },
        locale: 'es',
      })

      createdInstructors.push(instructor)
      console.log(`✅ Created instructor: ${instructorData.name}`)
    }

    // ======================
    // 5. CREATE CLASSES
    // ======================
    console.log('\n📋 Step 5: Creating classes...')

    // Helper: Get next occurrence of a specific weekday
    function getNextWeekday(dayOfWeek: number, weeksFromNow: number = 1): Date {
      const date = new Date()
      date.setDate(date.getDate() + weeksFromNow * 7)
      while (date.getDay() !== dayOfWeek) {
        date.setDate(date.getDate() + 1)
      }
      return date
    }

    // --- CLASS 1: "Mug Madness" (type: 'class') ---
    console.log('\n  Creating Class 1: Mug Madness...')
    const mugClass = await payload.create({
      collection: 'classes',
      data: {
        title: 'Mug Madness',
        slug: 'mug-madness',
        description: 'Create your own unique coffee mug from scratch! Learn hand-building techniques to craft a mug that reflects your personality. Glazing included in a follow-up firing.',
        type: 'class',
        instructor: createdInstructors[1].id,
        featuredImage: createdMedia[2]?.id,
        gallery: [createdMedia[4]?.id, createdMedia[5]?.id].filter(Boolean),
        priceCents: 4500,
        currency: 'eur',
        durationMinutes: 150,
        maxCapacity: 8,
        location: 'Studio A - Hand Building Room',
        tags: [createdTags[2].id, createdTags[4].id], // Ceramics, Hand Building
        isPublished: true,
      },
      locale: 'en',
    })

    await payload.update({
      collection: 'classes',
      id: mugClass.id,
      data: {
        title: 'Locura de Tazas',
        slug: 'locura-de-tazas',
        description: '¡Crea tu propia taza de café única desde cero! Aprende técnicas de construcción manual para crear una taza que refleje tu personalidad. El esmaltado está incluido en una cocción posterior.',
        location: 'Estudio A - Sala de Construcción Manual',
      },
      locale: 'es',
    })
    console.log(`  ✅ Created: Mug Madness`)

    // Create 2 sessions for Mug Madness (manual - one-time classes don't auto-generate)
    const mugSession1 = getNextWeekday(6, 1) // Next Saturday
    mugSession1.setHours(10, 0, 0, 0)
    const mugSession2 = getNextWeekday(6, 2) // Saturday after
    mugSession2.setHours(10, 0, 0, 0)

    for (const sessionDate of [mugSession1, mugSession2]) {
      await payload.create({
        collection: 'sessions',
        data: {
          sessionType: 'class',
          class: mugClass.id,
          startDateTime: sessionDate.toISOString(),
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          availableSpots: 8,
        },
      })
    }
    console.log(`  📅 Created 2 sessions for Mug Madness`)

    // --- CLASS 2: "Tiny Treasures" (type: 'class', kids) ---
    console.log('\n  Creating Class 2: Tiny Treasures (kids)...')
    const kidsClass = await payload.create({
      collection: 'classes',
      data: {
        title: 'Tiny Treasures - Kids Clay Workshop',
        slug: 'tiny-treasures-kids',
        description: 'A fun introduction to clay for children ages 6-12! Kids will create small animals, beads, and decorations while learning basic hand-building skills. Parent supervision welcome.',
        type: 'class',
        instructor: createdInstructors[0].id,
        featuredImage: createdMedia[2]?.id,
        gallery: [createdMedia[5]?.id, createdMedia[6]?.id].filter(Boolean),
        priceCents: 3500,
        currency: 'eur',
        durationMinutes: 90,
        maxCapacity: 10,
        location: 'Studio B - Family Room',
        tags: [createdTags[0].id, createdTags[2].id], // Kids & Family, Ceramics
        isPublished: true,
      },
      locale: 'en',
    })

    await payload.update({
      collection: 'classes',
      id: kidsClass.id,
      data: {
        title: 'Pequeños Tesoros - Taller de Arcilla para Niños',
        slug: 'pequenos-tesoros-ninos',
        description: '¡Una divertida introducción a la arcilla para niños de 6 a 12 años! Los niños crearán pequeños animales, cuentas y decoraciones mientras aprenden habilidades básicas de construcción manual. Supervisión de padres bienvenida.',
        location: 'Estudio B - Sala Familiar',
      },
      locale: 'es',
    })
    console.log(`  ✅ Created: Tiny Treasures`)

    // Create 3 sessions for Tiny Treasures
    const kidsSession1 = getNextWeekday(0, 1) // Next Sunday
    kidsSession1.setHours(11, 0, 0, 0)
    const kidsSession2 = getNextWeekday(0, 2)
    kidsSession2.setHours(11, 0, 0, 0)
    const kidsSession3 = getNextWeekday(0, 3)
    kidsSession3.setHours(11, 0, 0, 0)

    for (const sessionDate of [kidsSession1, kidsSession2, kidsSession3]) {
      await payload.create({
        collection: 'sessions',
        data: {
          sessionType: 'class',
          class: kidsClass.id,
          startDateTime: sessionDate.toISOString(),
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          availableSpots: 10,
        },
      })
    }
    console.log(`  📅 Created 3 sessions for Tiny Treasures`)

    // --- CLASS 3: "Wheel Therapy Tuesdays" (type: 'class', recurring schedule) ---
    console.log('\n  Creating Class 3: Wheel Therapy Tuesdays (recurring schedule)...')

    // Calculate recurrence dates
    const tuesdayStart = getNextWeekday(2, 1) // Next Tuesday
    tuesdayStart.setHours(0, 0, 0, 0)
    const tuesdayEnd = new Date(tuesdayStart)
    tuesdayEnd.setMonth(tuesdayEnd.getMonth() + 3) // 3 months of sessions

    // Create class first (schedule only works after save)
    const wheelClass = await payload.create({
      collection: 'classes',
      data: {
        title: 'Wheel Therapy Tuesdays',
        slug: 'wheel-therapy-tuesdays',
        description: 'Unwind after work with the meditative art of wheel throwing. Each session focuses on centering, pulling, and shaping clay. All levels welcome - beginners will start with cylinders, experienced throwers can work on personal projects.',
        type: 'class',
        instructor: createdInstructors[0].id,
        featuredImage: createdMedia[1]?.id,
        gallery: [createdMedia[4]?.id, createdMedia[6]?.id].filter(Boolean),
        priceCents: 4000,
        currency: 'eur',
        durationMinutes: 120,
        maxCapacity: 6,
        location: 'Studio C - Wheel Room',
        tags: [createdTags[2].id, createdTags[3].id],
        isPublished: true,
      },
      locale: 'en',
    })

    // Now update with schedule to trigger session generation
    await payload.update({
      collection: 'classes',
      id: wheelClass.id,
      data: {
        schedule: {
          startDate: tuesdayStart.toISOString(),
          endDate: tuesdayEnd.toISOString(),
          recurrence: 'weekly',
          daysOfWeek: ['2'], // Tuesday
          startTime: '18:30',
          timezone: 'Europe/Madrid',
        },
      },
    })

    await payload.update({
      collection: 'classes',
      id: wheelClass.id,
      data: {
        title: 'Martes de Terapia con Torno',
        slug: 'martes-terapia-torno',
        description: 'Relájate después del trabajo con el arte meditativo del torno. Cada sesión se enfoca en centrar, estirar y dar forma a la arcilla. Todos los niveles son bienvenidos - los principiantes comenzarán con cilindros, los torneros experimentados pueden trabajar en proyectos personales.',
        location: 'Estudio C - Sala de Tornos',
      },
      locale: 'es',
    })

    // Check if sessions were auto-generated
    const wheelSessions = await payload.find({
      collection: 'sessions',
      where: { class: { equals: wheelClass.id } },
      limit: 100,
    })

    if (wheelSessions.docs.length === 0) {
      console.log(`  ⚠️  Hook didn't generate sessions, creating manually...`)
      // Manual fallback: generate sessions ourselves
      let currentDate = new Date(tuesdayStart)
      let sessionCount = 0
      while (currentDate <= tuesdayEnd) {
        if (currentDate.getDay() === 2) { // Tuesday
          const sessionStart = new Date(currentDate)
          sessionStart.setHours(18, 30, 0, 0)
          await payload.create({
            collection: 'sessions',
            data: {
              sessionType: 'class',
              class: wheelClass.id,
              startDateTime: sessionStart.toISOString(),
              timezone: 'Europe/Madrid',
              status: 'scheduled',
              availableSpots: 6,
            },
          })
          sessionCount++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      console.log(`  📅 Manually created ${sessionCount} sessions for Wheel Therapy Tuesdays`)
    } else {
      console.log(`  ✅ Created: Wheel Therapy Tuesdays (${wheelSessions.docs.length} sessions auto-generated)`)
    }

    // ======================
    // 6. CREATE COURSE (type: 'course' in classes collection)
    // ======================
    console.log('\n📋 Step 6: Creating course...')

    // Calculate course dates (every Monday for a month)
    const mondayStart = getNextWeekday(1, 1) // Next Monday
    mondayStart.setHours(0, 0, 0, 0)
    const mondayEnd = new Date(mondayStart)
    mondayEnd.setDate(mondayEnd.getDate() + 28) // 4 weeks (5 Mondays typically)

    // Create course (now in classes collection with type: 'course')
    const potCourse = await payload.create({
      collection: 'classes',
      data: {
        title: 'Paint Your Own Pot on Mondays',
        slug: 'paint-your-own-pot-mondays',
        description: 'A 4-week journey into the colorful world of ceramic glazing! Each Monday, you\'ll learn different techniques: underglaze painting, majolica, wax resist, and layering. By the end, you\'ll have 4 beautifully decorated pieces ready for the kiln.',
        type: 'course', // Course type - enrollment books ALL sessions
        instructor: createdInstructors[1].id,
        featuredImage: createdMedia[0]?.id,
        gallery: [createdMedia[4]?.id, createdMedia[5]?.id, createdMedia[6]?.id].filter(Boolean),
        priceCents: 16000,
        currency: 'eur',
        maxCapacity: 8,
        durationMinutes: 150,
        location: 'Studio A - Glazing Station',
        tags: [createdTags[2].id, createdTags[5].id],
        isPublished: true,
      },
      locale: 'en',
    })

    // Update with schedule to trigger session generation
    await payload.update({
      collection: 'classes',
      id: potCourse.id,
      data: {
        schedule: {
          startDate: mondayStart.toISOString(),
          endDate: mondayEnd.toISOString(),
          recurrence: 'weekly',
          daysOfWeek: ['1'], // Monday
          startTime: '17:00',
          timezone: 'Europe/Madrid',
        },
      },
    })

    // Spanish translation
    await payload.update({
      collection: 'classes',
      id: potCourse.id,
      data: {
        title: 'Pinta Tu Propia Maceta los Lunes',
        slug: 'pinta-tu-maceta-lunes',
        description: '¡Un viaje de 4 semanas al colorido mundo del esmaltado cerámico! Cada lunes aprenderás diferentes técnicas: pintura con engobes, mayólica, resistencia con cera y capas. Al final, tendrás 4 piezas bellamente decoradas listas para el horno.',
        location: 'Estudio A - Estación de Esmaltado',
      },
      locale: 'es',
    })

    // Check if sessions were auto-generated
    const courseSessions = await payload.find({
      collection: 'sessions',
      where: { class: { equals: potCourse.id } },
      limit: 100,
    })

    if (courseSessions.docs.length === 0) {
      console.log(`  ⚠️  Hook didn't generate sessions, creating manually...`)
      // Manual fallback: generate course sessions ourselves
      let currentDate = new Date(mondayStart)
      let sessionCount = 0
      while (currentDate <= mondayEnd) {
        if (currentDate.getDay() === 1) { // Monday
          const sessionStart = new Date(currentDate)
          sessionStart.setHours(17, 0, 0, 0)
          await payload.create({
            collection: 'sessions',
            data: {
              sessionType: 'course',
              class: potCourse.id,
              startDateTime: sessionStart.toISOString(),
              timezone: 'Europe/Madrid',
              status: 'scheduled',
              availableSpots: 8,
            },
          })
          sessionCount++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      console.log(`  📅 Manually created ${sessionCount} sessions for Paint Your Own Pot`)
    } else {
      console.log(`  ✅ Created: Paint Your Own Pot on Mondays (${courseSessions.docs.length} sessions auto-generated)`)
    }

    // ======================
    // SUMMARY
    // ======================
    console.log('\n🎉 Seed completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`  ✓ 1 Admin user`)
    console.log(`  ✓ ${createdMedia.length} Media files`)
    console.log(`  ✓ ${createdTags.length} Tags`)
    console.log(`  ✓ ${createdInstructors.length} Instructors`)
    console.log(`  ✓ 4 Classes (3 type:class, 1 type:course):`)
    console.log(`      - Mug Madness (type:class, Saturdays)`)
    console.log(`      - Tiny Treasures (type:class, Sundays, kids)`)
    console.log(`      - Wheel Therapy Tuesdays (type:class, recurring Tuesdays)`)
    console.log(`      - Paint Your Own Pot on Mondays (type:course, 4 week enrollment)`)

    console.log('\nYou can now:')
    console.log('  1. Run: pnpm dev')
    console.log('  2. Visit: http://localhost:4321/admin')
    console.log('  3. Login: admin@bizcocho.art / admin123')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
