import { Message } from "discord.js";
import config from "../../config.js";

export default async function autoThreads(message: Message) {
  if (message.guildId !== "1064594649668395128" || message.author.bot) return;

  const threadNameTamplate =
    message.channelId in config.autoThreadedChannels
      ? config.autoThreadedChannels[message.channelId]
      : null;

  if (!threadNameTamplate) return;

  // Currently not used
}
