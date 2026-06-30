import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://e1f5ace1275e159e6376b98b9527f2aa@o4511653850382336.ingest.us.sentry.io/4511653887213568",

  // Performance monitoring (APM)
  tracesSampleRate: 1.0,

  debug: false,
});
