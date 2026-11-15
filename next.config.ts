import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: () => [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'microphone=(self), camera=(self), geolocation=()' },
  ] }],
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  outputFileTracingIncludes: { '/*': ['./db/migrations/*.sql'] },
  outputFileTracingExcludes: { '/*': ['./.env*', './.data/**', './tests/**', './docs/**'] },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
