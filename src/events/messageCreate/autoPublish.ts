import { Message, MessageType } from "discord.js";
import config from "../../config.js";

type ChannelConfig = {
  pings?: { id: string; type: 1 | 2 }[];
  whitelist?: { id: string; type: 1 | 2 }[];
  blacklist?: { id: string; type: 1 | 2 }[];
  notes?: string;
};

export default async function autoPublish(message: Message) {
  if (
    message.guildId !== process.env.GUILD_ID ||
    message.type != MessageType.Default
  )
    return;

  const channelConfig = config.autoPublishChannels.find(
    (c) => c.id === message.channelId
  );

  if (!channelConfig) return;

  let isBlacklisted: boolean = undefined;
  if (Array.isArray(channelConfig.blacklist))
      isBlacklisted = channelConfig.blacklist.some((be) =>
          be.type == 1
            ? be.id == message.author.id
            : message.author.roles.cache.has(be.id)
      );

  if (isBlacklisted === false) return;

  let isWhitelisted: boolean = undefined;
  if (Array.isArray(channelConfig.whitelist))
      isWhitelisted = channelConfig.whitelist.some((be) =>
          be.type == 1
            ? be.id == message.author.id
            : message.author.roles.cache.has(be.id)
      );

  if (isWhitelisted === false) return;

  let isValidPing = true;
  if (Array.isArray(validChannel.pings)) {
    isValidPing = false;
    isValidPing = validChannel.pings.some((ping) =>
      ping.type == 1
        ? message.mentions.users.has(ping.id))
        : message.mentions.roles.has(ping.id))
    );
  }

  if (validChannel && isValidPing) {
    try {
      await message.crosspost();
    } catch (error) {
      console.error("Message crosst failed:", error);
    }
  }
}
