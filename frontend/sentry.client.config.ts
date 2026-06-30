import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay integration (visual records of user behavior, masked for privacy)
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Performance monitoring (APM)
  tracesSampleRate: 1.0,

  // Session Replay sampling (10% standard, 100% on error)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  debug: false,
});
