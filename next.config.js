const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/presets": ["./data/presets/**/*"],
    "/api/generateSignLinkFromPreset": ["./data/presets/**/*"],
  },
  images: {
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://vierra-server.vercel.app https://api.linkedin.com https://graph.facebook.com https://www.googleapis.com https://www.linkedin.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;