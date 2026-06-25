const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.vierradev.com" }],
        destination: "https://vierradev.com/:path*",
        permanent: true,
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/presets": ["./data/presets/**/*"],
    "/api/generateSignLinkFromPreset": ["./data/presets/**/*"],
    "/api/md/[[...slug]]": ["./content/md/**/*"],
  },
  images: {
    // Prefer AVIF (smaller than WebP) then WebP for the optimizer output — improves
    // image transfer size / LCP. Browsers that support neither fall back to the original.
    formats: ['image/avif', 'image/webp'],
    // Quality levels used via <Image quality={...} /> must be declared (required in Next 16).
    qualities: [80],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.supabase.co https://vierra-server.vercel.app https://api.linkedin.com https://graph.facebook.com https://www.googleapis.com https://www.linkedin.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.google.com https://stats.g.doubleclick.net",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;