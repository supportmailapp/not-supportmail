import {
  ActivityType,
  Client,
  GatewayIntentBits,
  Options,
  Partials,
} from "discord.js";

var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],

  makeCache: Options.cacheWithLimits({
    MessageManager: 2048,
    GuildMessageManager: 1024,
  }),

  failIfNotExists: false,

  partials: [Partials.Channel, Partials.Message],

  allowedMentions: { parse: ["users", "roles"], repliedUser: false },

  presence: {
    activities: [
      {
        type: ActivityType.Listening,
        name: "Drinking hot chocolate and judging your 2026 resolutions",
      },
    ],
    status: "online",
  },
});
export { client };
