const configType = (
  await import("../config.schema.json", {
    with: { type: "json" },
  })
).default;
const data = (
  await import("../config.json" as string, {
    with: { type: "json" },
  }).catch(() => ({ default: {} }))
).default;

export type ConfigType = typeof configType;

const config = {
  ...data,
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
  developers: data.developers || [],
} as ConfigType & {
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

export default config;
