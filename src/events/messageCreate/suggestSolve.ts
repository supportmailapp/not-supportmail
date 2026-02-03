import { ChannelType, Message, type PartialMessage } from "discord.js";
import suggestSolveCache from "../../caches/suggestSolveCache";
import { buildSuggestSolveMessage } from "../../utils/main";
import config from "../../config";

const SUGGEST_SOLVE_PATTERNS = [
  /solved/i,
  /issue resolved/i,
  /fixed/i,
  /problem fixed/i,
  /thanks/i,
  /thank you/i,
  /thanks.*worked/i,
  /thank you.*worked/i,
  /worked.*thanks/i,
  /worked.*thank you/i,
  /resolved/i,
  /i fixed it/i,
  /i solved it/i,
  /all good now/i,
  /never mind.*fixed it/i,
];

const allTags = Object.values(config.supportTags);

export async function suggestSolve(msg: Message | PartialMessage) {
  if (
    !msg.inGuild() ||
    msg.author?.bot ||
    msg.channel.parentId !== config.channels.supportForum ||
    msg.channel.type !== ChannelType.PublicThread ||
    msg.channel.ownerId !== msg.author?.id || // Only suggest in user's own threads
    msg.channel.appliedTags.some((tag) => allTags.includes(tag))
  ) {
    return;
  }

  const content = msg.content.replace(/\s+/g, " ").replace("\n", " ");
  for (const pattern of SUGGEST_SOLVE_PATTERNS) {
    if (pattern.test(content)) {
      // check author here because regex is faster than DB call, so we only want to do DB call if necessary
      const setting = await suggestSolveCache.get(msg.author.id);
      if (!setting) return;
      const message = await buildSuggestSolveMessage(msg.client);
      return msg.reply({ ...message, allowedMentions: { repliedUser: false } });
    }
  }
}
