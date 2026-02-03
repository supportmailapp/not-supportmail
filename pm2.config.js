// This file is only used to run the bot in production with PM2 and Bun
// For development, use `bun dev`

export const name = "sm-helper";
export const script = "src/index.ts";
export const interpreter = "bun";
export const interpreter_args = "--env-file=.env.production --preload ./instrument.js";
export const env_production = {
  NODE_ENV: "production",
  PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
};