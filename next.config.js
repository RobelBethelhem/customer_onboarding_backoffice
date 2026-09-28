/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '',
  reactStrictMode: true,
  // F10: do not advertise the framework; add baseline security headers.
  // NOTE: the `Server: nginx` header is set by the reverse proxy — set `server_tokens off;`
  // and `proxy_hide_header Server;` in the nginx config to fully address that part.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ];
  },
  // Large base64 photos arrive via Server Actions; App-Router route handlers accept
  // large request bodies natively (no Pages-Router `api.bodyParser` config needed).
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

module.exports = nextConfig
