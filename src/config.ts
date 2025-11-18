const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export type ConfigType = typeof config;

export default {
  ...config,
  tags: {
    solved: process.env.TAG_SOLVED,
    dev: process.env.TAG_DEV,
  },
} as typeof config & {
  autoThreadedChannels: { [key: string]: ThreadConfig };
  autoPublishChannels: { [key: string]: ChannelConfig };
  tags: {
    solved: string;
    dev: string;
  };
};

type ThreadConfig = {
  schema: string;
  blacklist?: string[];
  whitelist?: string[];
  notes?: string;
};

type ChannelConfig = {
  pings?: string[];
  blacklist?: string[];
  whitelist?: string[];
  notes?: string;
};
