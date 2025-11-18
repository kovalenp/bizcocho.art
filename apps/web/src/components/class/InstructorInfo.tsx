import Image from 'next/image'
import type { Instructor, Media } from '@/payload-types'
import type { Messages } from '@/i18n/messages'

type InstructorInfoProps = {
  instructor: Instructor
  messages: Messages
}

export function InstructorInfo({ instructor, messages }: InstructorInfoProps) {
  const photo = instructor.photo as Media | null

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        {messages.classDetail.instructor}
      </h2>
      <div className="flex items-start gap-4">
        {photo && photo.url && (
          <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
            <Image src={photo.url} alt={instructor.name} fill className="object-cover" />
          </div>
        )}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{instructor.name}</h3>
          {instructor.bio && (
            <p className="text-gray-700 leading-relaxed">{instructor.bio}</p>
          )}
          {instructor.specialties && (
            <p className="text-sm text-gray-500 mt-2">{instructor.specialties}</p>
          )}
        </div>
      </div>
    </div>
  )
}
