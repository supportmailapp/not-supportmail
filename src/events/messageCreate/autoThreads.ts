import { Message } from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import config from "../../config.js";
import { checkUserAccess } from "../../utils/main.js";

type ThreadConfig = {
  schema: string;
  blacklist?: string[];
  whitelist?: string[];
  notes?: string;
};

export default async function autoThreads(message: Message) {
  if (message.guildId !== process.env.GUILD_ID || message.author.bot) return;

  const threadConfig = (config.autoThreadedChannels[message.channelId] ||
    null) as ThreadConfig | null;

  if (!threadConfig) return;

  if (
    !checkUserAccess(
      message.author.id,
      message.member.roles.cache.map((r) => r.id),
      threadConfig.blacklist || [],
      threadConfig.whitelist || []
    )
  ) {
    return;
  }

  // subsitute any {variables} in threadConfig.schema
  dayjs.extend(utc);
  dayjs.extend(timezone);
  const currentTime = dayjs().tz((config.timezone || "UTC") as any);

  const allVariables: { [key: string]: string } = {
    username: message.author.username,
    displayname: message.author.displayName || message.author.username,
    userid: message.author.id,
    date: currentTime.format("DD.MM.YYYY"),
    time: currentTime.format("HH:mm"),
  };

  let threadName = threadConfig.schema;
  for (const [key, value] of Object.entries(allVariables)) {
    threadName = threadName.replace(new RegExp(`{${key}}`, "gi"), value);
  }

  try {
    const thread = await message.channel.threads.create({
      name: threadName.slice(0, 100),
      reason: "Auto-created thread",
    });

    if (await thread.members.add(message.author.id).catch(() => null))
      console.log(`Thread ${threadName} created and user added.`);
  } catch (error) {
    console.error("Error creating thread:", error);
  }
}
