const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export type ConfigType = typeof config;

export default {
  ...config,
  tags: {
    unanswered: process.env.TAG_UNANSWERED,
    unsolved: process.env.TAG_UNSOLVED,
    solved: process.env.TAG_SOLVED,
    review: process.env.TAG_REVIEW,
  },
  priorityTags: {
    P0: process.env.TAG_PRIORITY_P0,
    P1: process.env.TAG_PRIORITY_P1,
    P2: process.env.TAG_PRIORITY_P2,
  },
} as typeof config & {
  autoThreadedChannels: { [key: string]: ThreadConfig };
  autoPublishChannels: { [key: string]: ChannelConfig };
  tags: {
    unanswered: string;
    unsolved: string;
    solved: string;
    review: string;
  };
  priorityTags: {
    P0: string;
    P1: string;
    P2: string;
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
