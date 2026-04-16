import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Watch Room',
    short_name: 'Watch Room',
    description: 'Private watch room for couples.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0d12',
    theme_color: '#0a0d12',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-180x180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
