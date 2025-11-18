export const messages = {
  // Common
  common: {
    openCms: 'Abrir CMS (Payload)',
    all: 'Todos',
    backToClasses: 'Volver a Clases',
  },

  // Home page
  home: {
    title: 'bizcocho.art',
    subtitle: 'Descubre tu creatividad a través de clases de arte',
    availableClasses: 'Clases Disponibles',
    noClasses: 'No hay clases disponibles',
    noClassesMessage: '¡Vuelve pronto para nuevas clases de arte!',
    noClassesForFilter: 'No hay clases para este filtro',
    tryDifferentFilter: 'Prueba con otro filtro',
    spots: 'plazas',
    min: 'min',
  },

  // Class detail page
  classDetail: {
    duration: 'Duración',
    minutes: 'minutos',
    location: 'Ubicación',
    capacity: 'Capacidad',
    price: 'Precio',
    instructor: 'Instructor',
    about: 'Sobre esta clase',
    gallery: 'Galería',
    bookNow: 'Reservar Ahora',
    spotsAvailable: 'plazas disponibles',
  },

  // Booking form
  booking: {
    title: 'Reserva tu Plaza',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo Electrónico',
    phone: 'Número de Teléfono',
    numberOfPeople: 'Número de Personas',
    submit: 'Confirmar Reserva',
    submitting: 'Reservando...',
    successTitle: '¡Reserva Confirmada!',
    success: 'Revisa tu correo electrónico para más detalles.',
    error: 'Error al crear la reserva. Por favor, inténtalo de nuevo.',
    requiredField: 'Este campo es obligatorio',
    invalidEmail: 'Por favor, ingresa un correo electrónico válido',
  },
} as const
