'use client'

import { useState } from 'react'
import type { ClassTemplate, Tag, Media } from '@/payload-types'
import type { Locale } from '@/i18n/config'

type ClassFilterProps = {
  classes: ClassTemplate[]
  tags: Tag[]
  locale: Locale
}

export function ClassFilter({ classes, tags, locale }: ClassFilterProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const filteredClasses = selectedTag
    ? classes.filter((cls) => {
        const classTags = cls.tags as (string | Tag)[]
        if (!classTags) return false
        return classTags.some((tag) => {
          const tagId = typeof tag === 'string' ? tag : tag.id
          return tagId === selectedTag
        })
      })
    : classes

  return (
    <div>
      {/* Tag Filter */}
      <div className="mb-8 flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => setSelectedTag(null)}
          className={`px-4 py-2 rounded-full text-sm transition-all duration-200 ${
            selectedTag === null
              ? 'border-2 border-primary bg-primary text-white font-semibold'
              : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-400'
          }`}
        >
          {locale === 'es' ? 'Todos' : 'All'}
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => setSelectedTag(tag.id)}
            className={`px-4 py-2 rounded-full text-sm transition-all duration-200 ${
              selectedTag === tag.id
                ? 'border-2 border-primary bg-primary text-white font-semibold'
                : 'border border-gray-300 bg-white text-gray-800 hover:border-gray-400'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {/* Class Grid */}
      {filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredClasses.map((classItem) => (
            <ClassCard key={classItem.id} data={classItem} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <h3 className="text-gray-600 text-lg font-medium">
            {locale === 'es' ? 'No hay clases para este filtro' : 'No classes for this filter'}
          </h3>
          <p className="text-gray-500 mt-2">
            {locale === 'es'
              ? 'Prueba con otro filtro'
              : 'Try a different filter'}
          </p>
        </div>
      )}
    </div>
  )
}

function ClassCard({ data, locale }: { data: ClassTemplate; locale: Locale }) {
  const featuredImage = data.featuredImage as Media | null
  const classTags = (data.tags as Tag[]) || []

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {featuredImage?.url && (
        <img
          src={featuredImage.url}
          alt={data.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <h3 className="mb-4 text-xl font-medium text-gray-800">
          {data.title}
        </h3>
        {data.description && (
          <p className="mb-4 text-gray-600 leading-relaxed">
            {data.description}
          </p>
        )}

        {/* Tags */}
        {classTags.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {classTags.map((tag) => (
              <span
                key={typeof tag === 'string' ? tag : tag.id}
                className="px-3 py-1 rounded-xl text-xs font-medium text-white"
                style={{
                  backgroundColor: typeof tag === 'string' ? '#f0f0f0' : tag.color || '#f0f0f0',
                  color: typeof tag === 'string' ? '#333' : '#fff',
                }}
              >
                {typeof tag === 'string' ? tag : tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <span className="text-2xl font-bold text-primary">
            €{((data.priceCents || 0) / 100).toFixed(2)}
          </span>
          <span className="bg-gray-100 px-2 py-1 rounded text-sm">
            {data.maxCapacity || 0} {locale === 'es' ? 'plazas' : 'spots'}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap text-sm text-gray-500">
          <span>
            ⏱️ {data.durationMinutes || 0} {locale === 'es' ? 'min' : 'min'}
          </span>
          {data.location && <span>📍 {data.location}</span>}
        </div>
      </div>
    </div>
  )
}
