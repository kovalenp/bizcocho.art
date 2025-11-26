'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Tag, Media } from '@/payload-types'
import type { Messages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'
import { type DisplayItem, isClassItem, isCourseItem, getDisplayItemProps } from '@/types/display'

type ClassFilterProps = {
  classes: DisplayItem[]
  tags: Tag[]
  messages: Messages
  locale: Locale
}

export function ClassFilter({ classes, tags, messages, locale }: ClassFilterProps) {
  const [selectedTag, setSelectedTag] = useState<string | number | null>(null)

  const filteredClasses = selectedTag
    ? classes.filter((item) => {
        const itemTags = item.data.tags as (string | Tag)[]
        if (!itemTags) return false
        return itemTags.some((tag) => {
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
          {filteredClasses.map((item) => {
            // Create unique key using item type and id to avoid collisions
            const uniqueKey = `${item.itemType}-${item.data.id}`
            return (
              <ClassCard key={uniqueKey} item={item} messages={messages} locale={locale} />
            )
          })}
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

function ClassCard({ item, messages, locale }: { item: DisplayItem; messages: Messages; locale: Locale }) {
  const props = getDisplayItemProps(item)
  const featuredImage = props.featuredImage
  const itemTags = props.tags

  // Use the proper type for link path
  const linkPath = isCourseItem(item)
    ? `/${locale}/courses/${props.slug}`
    : `/${locale}/classes/${props.slug}`

  return (
    <Link
      href={linkPath}
      className="group block no-underline bg-gray-50 rounded-lg overflow-hidden hover:bg-primary transition-all duration-300 ease-in-out"
    >
      {featuredImage?.url && (
        <div className="p-3 pb-0">
          <div className="overflow-hidden h-64 rounded-xl relative">
            <img
              src={featuredImage.url}
              alt={props.title}
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
              {props.maxCapacity} {messages.home.spots}
            </span>

            {/* Price */}
            <span className="text-lg font-medium text-gray-900 group-hover:text-white transition-colors duration-300">
              €{(props.priceCents / 100).toFixed(2)}
            </span>
          </div>

          {/* Tag - Outlined Pill */}
          {itemTags.length > 0 && (
            <span className="border border-gray-300 text-gray-600 px-3 py-1 rounded-full text-xs font-medium bg-white">
              {itemTags[0].name}
            </span>
          )}
        </div>

        <h3 className="mb-2 text-xl font-medium text-gray-900 group-hover:text-white transition-colors duration-300">
          {props.title}
        </h3>

        {props.description && (
          <p className="text-gray-600 leading-relaxed text-sm line-clamp-3 group-hover:text-white/90 transition-colors duration-300">
            {props.description}
          </p>
        )}
      </div>
    </Link>
  )
}
