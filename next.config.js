const { withSentryConfig } = require('@sentry/nextjs/config')

/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = withSentryConfig(nextConfig, {
  // Sentry build-time options: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  silent: true,

  // Org/project + auth token are needed to upload source maps. Unset until
  // SENTRY_DSN and friends are configured — see docs/backlog.md Epic 5-A.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Skip source map upload entirely when there's no auth token, so local
  // dev and CI builds without Sentry credentials still succeed.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  widenClientFileUpload: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
})
