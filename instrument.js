// Sentry stuff

import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["error", "info", "warn"] }),
    Sentry.eventFiltersIntegration({
      ignoreErrors: [
        'require() async module "/home/helper/bot/src/index.ts" is unsupported. use "await import()" instead.',
      ],
    }),
  ],
});
