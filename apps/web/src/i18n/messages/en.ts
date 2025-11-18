export const messages = {
  // Common
  common: {
    openCms: 'Open CMS (Payload)',
    all: 'All',
    backToClasses: 'Back to Classes',
  },

  // Home page
  home: {
    title: 'bizcocho.art',
    subtitle: 'Discover your creativity through art classes',
    availableClasses: 'Available Classes',
    noClasses: 'No classes available',
    noClassesMessage: 'Check back soon for new art classes!',
    noClassesForFilter: 'No classes for this filter',
    tryDifferentFilter: 'Try a different filter',
    spots: 'spots',
    min: 'min',
  },

  // Class detail page
  classDetail: {
    duration: 'Duration',
    minutes: 'minutes',
    location: 'Location',
    capacity: 'Capacity',
    price: 'Price',
    instructor: 'Instructor',
    about: 'About this class',
    gallery: 'Gallery',
    bookNow: 'Book Now',
    spotsAvailable: 'spots available',
  },

  // Booking form
  booking: {
    title: 'Book Your Spot',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone Number',
    numberOfPeople: 'Number of People',
    submit: 'Confirm Booking',
    submitting: 'Booking...',
    successTitle: 'Booking Confirmed!',
    success: 'Check your email for details.',
    error: 'Failed to create booking. Please try again.',
    requiredField: 'This field is required',
    invalidEmail: 'Please enter a valid email',
  },
} as const
