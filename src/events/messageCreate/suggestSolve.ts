import { ChannelType, Message, type PartialMessage } from "discord.js";
import suggestSolveCache from "../../caches/suggestSolveCache";
import { buildSuggestSolveMessage } from "../../utils/main";
import config from "../../config";
import { SupportPost } from "../../models/supportPosts";

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
    msg.channel.appliedTags.some((tag) => allTags.includes(tag))
  ) {
    return;
  }

  // ownership check
  if (msg.channel.ownerId === msg.client.user.id) {
    const post = await SupportPost.exists({
      postId: msg.channelId,
      userId: msg.author.id,
    });
    if (!post) {
      return;
    }
  } else if (msg.channel.ownerId !== msg.author.id) {
    return;
  }

  const content = msg.content.replace(/\s+/g, " ").replace("\n", " ");
  console.debug("[suggestSolve] Checking message content:", content);
  for (const pattern of SUGGEST_SOLVE_PATTERNS) {
    if (pattern.test(content)) {
      console.debug("[suggestSolve] Pattern matched:", pattern);
      // check author here because regex is faster than DB call, so we only want to do DB call if necessary
      const setting = await suggestSolveCache.get(msg.author.id);
      if (!setting.setting) {
        console.debug(
          "[suggestSolve] User has disabled suggest solve:",
          msg.author.id,
        );
        return;
      }
      const message = await buildSuggestSolveMessage(msg.client);
      return msg.reply({ ...message, allowedMentions: { repliedUser: false } });
    }
    {
      console.debug("[suggestSolve] Pattern not matched:", pattern);
    }
  }
}
