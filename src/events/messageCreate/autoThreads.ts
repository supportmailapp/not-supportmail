import { Message } from "discord.js";
const { autoThreadedChannels } = (
  await import("../../../config.json", { with: { type: "json" } })
).default;

export default async function autoThreads(message: Message) {
  if (message.guildId !== "1064594649668395128" || message.author.bot) return;

  const threadNameTamplate =
    message.channelId in autoThreadedChannels
      ? autoThreadedChannels[message.channelId]
      : null;

  if (!threadNameTamplate) return;

  // Currently not used
}
