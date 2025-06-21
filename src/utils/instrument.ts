// Sentry stuff

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions

  _experiments: { enableLogs: true },
});
