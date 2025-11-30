'use client'

import { useState } from 'react'
import type { Class, Session, Media, Instructor, Tag } from '@/payload-types'
import type { Messages } from '@/i18n/messages'
import { ImageGallery } from './ImageGallery'
import { ClassInfo } from './ClassInfo'
import { SessionSelector } from '../booking/SessionSelector'
import { InstructorInfo } from './InstructorInfo'
import { BookingWidget } from '../booking/BookingWidget'

type ClassDetailLayoutProps = {
  classTemplate: Class
  classSessions: Session[]
  featuredImage: Media | null
  gallery: Media[]
  tags: Tag[]
  instructor: Instructor | null
  messages: Messages
  locale: string
}

export function ClassDetailLayout({
  classTemplate,
  classSessions,
  featuredImage,
  gallery,
  tags,
  instructor,
  messages,
  locale,
}: ClassDetailLayoutProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main content - 2 columns */}
      <div className="lg:col-span-2 space-y-6">
        {/* Image Gallery */}
        {(featuredImage || gallery.length > 0) && (
          <ImageGallery featuredImage={featuredImage} gallery={gallery} title={classTemplate.title} />
        )}

        {/* Class Info */}
        <ClassInfo classTemplate={classTemplate} tags={tags} messages={messages} />

        {/* Session Selector */}
        {classSessions.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {messages.booking.selectSession}
            </h3>
            <SessionSelector
              sessions={classSessions}
              classTemplate={classTemplate}
              selectedSessionId={selectedSessionId}
              onSessionSelect={setSelectedSessionId}
              messages={messages}
            />
          </div>
        )}

        {/* About the class */}
        {classTemplate.description && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {messages.classDetail.about}
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {classTemplate.description}
            </p>
          </div>
        )}

        {/* Instructor */}
        {instructor && <InstructorInfo instructor={instructor} messages={messages} />}
      </div>

      {/* Sidebar - Booking Widget */}
      <div className="lg:col-span-1">
        <BookingWidget
          classTemplate={classTemplate}
          classSessions={classSessions}
          selectedSessionId={selectedSessionId}
          onSessionSelect={setSelectedSessionId}
          messages={messages}
          locale={locale}
        />
      </div>
    </div>
  )
}
