// This file is only used to run the bot in production with PM2 and Bun
// For development, use `bun dev`

module.exports = {
  apps: [
    {
      name: "sm-helper",
      script: "~/.bun/bin/bun",
      args: "run --env-file=.env.production --preload ./instrument.js src/index.ts",
      interpreter: "none", // Bun + pm2 = issues, so we have to use this workaround to run the bot with Bun
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
