const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export type ConfigType = typeof config;

export default {
  ...config,
  supportTags: {
    solved: process.env.TAG_SOLVED,
    dev: process.env.TAG_DEV,
    wrongChannel: process.env.TAG_WRONG_CHANNEL,
  },
  suggestionTags: {
    noted: process.env.TAG_NOTED,
    accepted: process.env.TAG_ACCEPTED,
    rejected: process.env.TAG_REJECTED,
    implemented: process.env.TAG_IMPLEMENTED,
    duplicate: process.env.TAG_DUPLICATE,
  },
  channels: {
    supportForum: process.env.CHANNEL_SUPPORT_FORUM,
    botCommands: process.env.CHANNEL_BOT_COMMANDS,
    ticketSupport: process.env.CHANNEL_TICKET_SUPPORT,
  },
  developers: config.developers || [],
} as typeof config & {
  autoThreadedChannels: { [key: string]: ThreadConfig };
  autoPublishChannels: { [key: string]: ChannelConfig };
  supportTags: {
    solved: string;
    dev: string;
    wrongChannel: string;
  };
  suggestionTags: {
    noted: string;
    accepted: string;
    rejected: string;
    implemented: string;
    duplicate: string;
  };
  channels: {
    supportForum: string;
    botCommands: string;
    ticketSupport: string;
  };
  developers: { id: string; gender: "m" | "f" | "d" }[];
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
