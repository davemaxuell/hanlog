import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'HanLog · Your day, in Korean', short_name: 'HanLog',
    description: 'Short speaking practice, useful feedback, and everyday Korean with peers.',
    start_url: '/app', scope: '/', display: 'standalone', lang: 'en',
    background_color: '#D2F6FC', theme_color: '#D2F6FC',
    icons: [
      { src: '/icons/hanlog-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/hanlog-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/hanlog-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['education', 'social'],
  };
}
