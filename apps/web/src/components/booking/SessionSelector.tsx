'use client'

import type { ClassSession, ClassTemplate } from '@/payload-types'
import type { Messages } from '@/i18n/messages'

type SessionSelectorProps = {
  sessions: ClassSession[]
  classTemplate: ClassTemplate
  selectedSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  messages: Messages
}

export function SessionSelector({
  sessions,
  classTemplate,
  selectedSessionId,
  onSessionSelect,
  messages,
}: SessionSelectorProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
        {messages.booking.noSessions}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const availableSpots =
          session.availableSpots !== undefined && session.availableSpots !== null
            ? session.availableSpots
            : classTemplate.maxCapacity || 0
        const isFull = availableSpots === 0
        const sessionDate = new Date(session.startDateTime)
        const isSelected = selectedSessionId === session.id.toString()

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => !isFull && onSessionSelect(session.id.toString())}
            disabled={isFull}
            className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
              isSelected
                ? 'border-primary bg-blue-50 ring-2 ring-primary'
                : isFull
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                : 'border-gray-300 hover:border-primary hover:bg-gray-50'
            }`}
          >
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {sessionDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="text-sm text-gray-600">
                {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-primary">{availableSpots}</div>
              <div className="text-xs text-gray-500">
                {isFull ? messages.booking.sessionFull : messages.classDetail.spotsAvailable}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
