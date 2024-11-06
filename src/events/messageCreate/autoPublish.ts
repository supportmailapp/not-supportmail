import { Message } from "discord.js";
const { autoPublishChannels } = (
  await import("../../../config.json", { with: { type: "json" } })
).default;

export default async function autoPublish(message: Message) {
  if (message.guildId !== "1064594649668395128" || message.author.bot) return;

  const validChannel = autoPublishChannels.find(
    (channel) => channel.id === message.channelId
  );

  let isValidPing = Boolean(validChannel);
  if (isValidPing) {
    if (typeof validChannel.pings != "undefined") {
      isValidPing = validChannel.pings.some(
        (ping) =>
          (ping.type == 1 && message.mentions.users.has(ping.id)) ||
          (ping.type == 2 && message.mentions.roles.has(ping.id))
      );
    }
  }

  if (validChannel && isValidPing) {
    try {
      await message.crosspost();
    } catch (error) {
      console.error(error);
    }
  }
}
