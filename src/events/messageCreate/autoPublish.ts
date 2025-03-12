import { Message, MessageType } from "discord.js";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import config from "../../config.js";
import { checkUserAccess } from "../../utils/main.js";

type ChannelConfig = {
  pings?: string[];
  blacklist?: string[];
  whitelist?: string[];
  notes?: string;
};

export default async function autoPublish(message: Message) {
  if (
    message.guildId !== process.env.GUILD_ID ||
    message.type != MessageType.Default
  )
    return;

  const channelConfig = (config.autoPublishChannels[message.channelId] ||
    null) as ChannelConfig | null;

  if (!channelConfig) return;

  if (
    !checkUserAccess(
      message.author.id,
      message.member.roles.cache.map((r) => r.id),
      channelConfig.blacklist || [],
      channelConfig.whitelist || []
    )
  ) {
    return;
  }

  let isValidPing = true;
  if (Array.isArray(channelConfig.pings)) {
    isValidPing = false;
    isValidPing = channelConfig.pings.some((ping) => {
      const [type, id] = ping.split("-");
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
