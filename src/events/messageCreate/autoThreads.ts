import { Message } from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import config from "../../config.js";
import { checkUserAccess } from "../../utils/main.js";

const UTCOffeset = process.env.UTC_OFFSET || null;
dayjs.extend(utc);

export async function autoThreads(message: Message) {
  if (
    message.channel.isDMBased() ||
    message.channel.isThread() ||
    message.channel.isVoiceBased() ||
    message.guildId !== process.env.GUILD_ID ||
    message.author.bot
  ) {
    return;
  }

  const threadConfig = config.autoThreadedChannels[message.channelId] || null;

  if (!threadConfig) return;

  if (
    !checkUserAccess(
      message.author.id,
      message.member?.roles.cache.map((r) => r.id) || [],
      threadConfig.blacklist || [],
      threadConfig.whitelist || [],
    )
  ) {
    return;
  }

  let currentTime = dayjs();
  if (UTCOffeset) {
    if (/^\+?\d+$/i.test(UTCOffeset)) {
      currentTime = currentTime.add(parseInt(UTCOffeset), "h");
    } else {
      currentTime = currentTime.subtract(Math.abs(parseInt(UTCOffeset)), "h");
    }
  } else {
    currentTime = currentTime.utc();
  }

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
