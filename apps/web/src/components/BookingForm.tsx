'use client'

import { useState } from 'react'
import type { ClassTemplate } from '@/payload-types'
import type { Messages } from '@/i18n/messages'

type BookingFormProps = {
  classTemplate: ClassTemplate
  messages: Messages
}

type FormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  numberOfPeople: number
}

type FormErrors = Partial<Record<keyof FormData, string>>

export function BookingForm({ classTemplate, messages }: BookingFormProps) {
  // Calculate available spots
  const availableSpots = classTemplate.availableSpots !== undefined && classTemplate.availableSpots !== null
    ? classTemplate.availableSpots
    : classTemplate.maxCapacity || 0

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    numberOfPeople: 1,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = messages.booking.requiredField
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = messages.booking.requiredField
    }
    if (!formData.email.trim()) {
      newErrors.email = messages.booking.requiredField
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = messages.booking.invalidEmail
    }
    if (!formData.phone.trim()) {
      newErrors.phone = messages.booking.requiredField
    }
    if (formData.numberOfPeople < 1 || formData.numberOfPeople > availableSpots) {
      newErrors.numberOfPeople = messages.booking.requiredField
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classTemplate: classTemplate.id,
          ...formData,
        }),
      })

      if (!response.ok) {
        throw new Error('Booking failed')
      }

      setSubmitStatus('success')
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        numberOfPeople: 1,
      })
    } catch (error) {
      console.error('Booking error:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        {messages.booking.title}
      </h2>

      {submitStatus === 'success' ? (
        <div className="p-8 bg-green-50 border-2 border-green-300 rounded-lg text-center">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-2xl font-semibold text-green-900 mb-2">
            {messages.booking.successTitle}
          </h3>
          <p className="text-green-800 text-lg">
            {messages.booking.success}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-primary mb-2">
              €{((classTemplate.priceCents || 0) / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              {availableSpots} {messages.classDetail.spotsAvailable}
            </div>
          </div>

          {submitStatus === 'error' && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {messages.booking.error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            {messages.booking.firstName}
          </label>
          <input
            type="text"
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            {messages.booking.lastName}
          </label>
          <input
            type="text"
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {messages.booking.email}
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            {messages.booking.phone}
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        {/* Number of People */}
        <div>
          <label htmlFor="numberOfPeople" className="block text-sm font-medium text-gray-700 mb-1">
            {messages.booking.numberOfPeople}
          </label>
          <input
            type="number"
            id="numberOfPeople"
            min="1"
            max={availableSpots}
            value={formData.numberOfPeople}
            onChange={(e) => handleChange('numberOfPeople', parseInt(e.target.value) || 1)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
              errors.numberOfPeople ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.numberOfPeople && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfPeople}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? messages.booking.submitting : messages.booking.submit}
        </button>
      </form>
        </>
      )}
    </div>
  )
}
