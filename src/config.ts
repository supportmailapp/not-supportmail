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
    "priority-P0": process.env.TAG_PRIORITY_P0,
    "priority-P1": process.env.TAG_PRIORITY_P1,
    "priority-P2": process.env.TAG_PRIORITY_P2,
  },
} as typeof config & {
  autoThreadedChannels: { [key: string]: ThreadConfig };
  autoPublishChannels: { [key: string]: ChannelConfig };
  tags: {
    unanswered: string;
    unsolved: string;
    solved: string;
    review: string;
    "priority-P0": string;
    "priority-P1": string;
    "priority-P2": string;
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
