import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Turnos · Dra. Natalia Volpe',
    short_name: 'Dra. Volpe',
    description: 'Reservá tu turno con la Dra. Natalia Hebe Volpe, Médica Psiquiatra.',
    start_url: '/',
    display: 'standalone',
    background_color: '#06b6d4',
    theme_color: '#06b6d4',
    orientation: 'portrait',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
