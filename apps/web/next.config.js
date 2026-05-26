/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Turbopack bundles its own CA roots; use the OS store so Google Fonts
    // (next/font/google) can download during dev on networks with custom CAs.
    turbopackUseSystemTlsCerts: true,
  },
  // Process workspace package through the bundler so Turbopack always
  // picks up newly-exported symbols without a stale module-graph cache.
  transpilePackages: ["@mergesignal/shared"],
  async headers() {
    // 'unsafe-inline' in script-src is required for Next.js hydration scripts.
    // It reduces header-level XSS protection, but the practical risk is low:
    // React escapes all rendered content and dangerouslySetInnerHTML is not
    // used anywhere. Future direction: migrate to a nonce-based CSP.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.github.com",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/getting-started",
        permanent: true,
      },
      {
        source: "/docs/getting-started",
        destination: "/getting-started",
        permanent: true,
      },
      {
        source: "/docs/github-actions",
        destination: "/getting-started#github-actions",
        permanent: true,
      },
      {
        source: "/docs/github-app",
        destination: "/getting-started#github-app",
        permanent: true,
      },
      {
        source: "/docs/ci",
        destination: "/getting-started#github-actions",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
