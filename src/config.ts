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
    solved: Bun.env.TAG_SOLVED,
    dev: Bun.env.TAG_DEV,
    wrongChannel: Bun.env.TAG_WRONG_CHANNEL,
    bots: {
      supportmail: Bun.env.TAG_SUPPORTMAIL,
      ticketOn: Bun.env.TAG_TICKETON,
      upvoteEngine: Bun.env.TAG_UPVOTE_ENGINE,
    },
  },
  suggestionTags: {
    noted: Bun.env.TAG_NOTED,
    accepted: Bun.env.TAG_ACCEPTED,
    rejected: Bun.env.TAG_REJECTED,
    implemented: Bun.env.TAG_IMPLEMENTED,
    duplicate: Bun.env.TAG_DUPLICATE,
  },
  channels: {
    supportForum: Bun.env.CHANNEL_SUPPORT_FORUM,
    botCommands: Bun.env.CHANNEL_BOT_COMMANDS,
    ticketSupport: Bun.env.CHANNEL_TICKET_SUPPORT,
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
