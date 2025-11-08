/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['api.mapbox.com', 'mapbox.com'],
  },
  eslint: {
    // Ignore ESLint errors during builds for faster deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Only fail on TypeScript errors, not warnings
    ignoreBuildErrors: false,
  },
  env: {
    // API Configuration
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,

    // Mapbox Configuration
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,

    // Application Info
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,

    // Feature Flags
    NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  },
};

module.exports = nextConfig; 