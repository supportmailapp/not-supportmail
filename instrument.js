// Sentry stuff

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.7,
  sendDefaultPii: true,
  enableLogs: true,
});
