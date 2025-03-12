import { Message } from "discord.js";
import config from "../../config.js";

type ThreadConfig = {
  schema: string;
  whitelist: { id: string; type: 1 | 2 }[];
  blacklist: { id: string; type: 1 | 2 }[];
  notes?: string;
};

export default async function autoThreads(message: Message) {
  if (message.guildId !== process.env.GUILD_ID || message.author.bot) return;

  const threadConfig =
    message.channelId in config.autoThreadedChannels
      ? config.autoThreadedChannels[message.channelId]
      : null;

  if (!threadConfig) return;

  let isBlacklisted = false;
  if (threadConfig.blacklist?.length)
      threadConfig.blacklist.forEach((be) => be.type = 1);
}
