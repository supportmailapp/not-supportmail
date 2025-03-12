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
      isBlacklisted = threadConfig.blacklist.some((be) =>
          be.type == 1
            ? be.id == message.author.id
            : message.author.roles.cache.has(be.id)
      );

  if (isBlacklisted) return;

  let isWhitelisted = false;
  if (threadConfig.whitelist?.length)
      isWhitelisted = threadConfig.whitelist.some((be) =>
          be.type == 1
            ? be.id == message.author.id
            : message.author.roles.cache.has(be.id)
      );

  if (!isWhitelisted) return;

  const allVariables: any = {};

  // subsitute any {variables} in threadConfig.scheme
}
