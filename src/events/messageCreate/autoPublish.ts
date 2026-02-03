import { Message, MessageType, type PartialMessage } from "discord.js";
import config from "../../config.js";
import { checkUserAccess } from "../../utils/main.js";

export async function autoPublish(message: Message | PartialMessage) {
  if (
    message.guildId !== Bun.env.GUILD_ID ||
    message.type != MessageType.Default
  ) {
    return;
  }

  const channelConfig = config.autoPublishChannels[message.channelId] || null;

  if (!channelConfig) return;

  if (
    !checkUserAccess(
      message.author.id,
      message.member?.roles.cache.map((r) => r.id) || [],
      channelConfig.blacklist || [],
      channelConfig.whitelist || [],
    )
  ) {
    return;
  }

  let isValidPing = true;
  if (Array.isArray(channelConfig.pings)) {
    isValidPing = false;
    isValidPing = channelConfig.pings.some((ping) => {
      const [type, id] = ping.split("-") as ["u" | "r", string];
      if (type === "u") {
        return message.mentions.users.has(id);
      } else {
        return message.mentions.roles.has(id);
      }
    });
  }

  if (isValidPing) {
    try {
      await message.crosspost();
    } catch (error) {
      console.error("Message crosspost failed:", error);
    }
  }
}
