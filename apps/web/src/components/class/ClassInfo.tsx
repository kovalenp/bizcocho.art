import type { ClassTemplate, Tag } from '@/payload-types'
import type { Messages } from '@/i18n/messages'

type ClassInfoProps = {
  classTemplate: ClassTemplate
  tags: Tag[]
  messages: Messages
}

export function ClassInfo({ classTemplate, tags, messages }: ClassInfoProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{classTemplate.title}</h1>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{
                backgroundColor: tag.color || '#f0f0f0',
                color: '#fff',
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Quick info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-sm text-gray-500">{messages.classDetail.duration}</div>
          <div className="text-lg font-semibold text-gray-900">
            {classTemplate.durationMinutes} {messages.classDetail.minutes}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">{messages.classDetail.capacity}</div>
          <div className="text-lg font-semibold text-gray-900">
            {classTemplate.maxCapacity} {messages.home.spots}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">{messages.classDetail.price}</div>
          <div className="text-lg font-semibold text-primary">
            €{((classTemplate.priceCents || 0) / 100).toFixed(2)}
          </div>
        </div>
        {classTemplate.location && (
          <div>
            <div className="text-sm text-gray-500">{messages.classDetail.location}</div>
            <div className="text-lg font-semibold text-gray-900">{classTemplate.location}</div>
          </div>
        )}
      </div>
    </div>
  )
}
