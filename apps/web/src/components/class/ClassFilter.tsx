'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ClassTemplate, Tag, Media } from '@/payload-types'
import type { Messages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'

type ClassFilterProps = {
  classes: ClassTemplate[]
  tags: Tag[]
  messages: Messages
  locale: Locale
}

export function ClassFilter({ classes, tags, messages, locale }: ClassFilterProps) {
  const [selectedTag, setSelectedTag] = useState<string | number | null>(null)

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
          {messages.common.all}
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
            <ClassCard key={classItem.id} data={classItem} messages={messages} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <h3 className="text-gray-600 text-lg font-medium">
            {messages.home.noClassesForFilter}
          </h3>
          <p className="text-gray-500 mt-2">
            {messages.home.tryDifferentFilter}
          </p>
        </div>
      )}
    </div>
  )
}

function ClassCard({ data, messages, locale }: { data: ClassTemplate; messages: Messages; locale: Locale }) {
  const featuredImage = data.featuredImage as Media | null
  const classTags = (data.tags as Tag[]) || []

  return (
    <Link
      href={`/${locale}/classes/${data.slug}`}
      className="group block no-underline bg-gray-50 rounded-lg overflow-hidden hover:bg-primary transition-all duration-300 ease-in-out"
    >
      {featuredImage?.url && (
        <div className="p-3 pb-0">
          <div className="overflow-hidden h-64 rounded-xl relative">
            <img
              src={featuredImage.url}
              alt={data.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          </div>
        </div>
      )}
      <div className="p-6">
        {/* Header Row: Slots, Price, Tag */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            {/* Available Slots - Black Pill */}
            <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-medium">
              {data.maxCapacity || 0} {messages.home.spots}
            </span>
            
            {/* Price */}
            <span className="text-lg font-medium text-gray-900 group-hover:text-white transition-colors duration-300">
              €{((data.priceCents || 0) / 100).toFixed(2)}
            </span>
          </div>

          {/* Tag - Outlined Pill */}
          {classTags.length > 0 && (
            <span className="border border-gray-300 text-gray-600 px-3 py-1 rounded-full text-xs font-medium bg-white">
              {typeof classTags[0] === 'string' ? classTags[0] : classTags[0].name}
            </span>
          )}
        </div>

        <h3 className="mb-2 text-xl font-medium text-gray-900 group-hover:text-white transition-colors duration-300">
          {data.title}
        </h3>
        
        {data.description && (
          <p className="text-gray-600 leading-relaxed text-sm line-clamp-3 group-hover:text-white/90 transition-colors duration-300">
            {data.description}
          </p>
        )}
      </div>
    </Link>
  )
}
