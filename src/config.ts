const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export default {
  ...config,
  tags: {
    unanswered: process.env.TAG_UNANSWERED,
    unsolved: process.env.TAG_UNSOLVED,
    solved: process.env.TAG_SOLVED,
    review: process.env.TAG_REVIEW,
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
