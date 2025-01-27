import { ChannelType, Message } from "discord.js";

import config from "../../config.js";
import { SupportPost } from "../../models/supportPost.js";

/**
 * Adjusts the tags of a post based on the message author.
 */
export default async function adjustPostTags(message: Message) {
  if (
    message.channel.isDMBased() ||
    message.channel.type !== ChannelType.PublicThread ||
    message.channel.parentId !== config.supportForumId ||
    message.channel.parent?.type !== ChannelType.GuildForum ||
    message.author.bot
  )
    return;

  const tags = message.channel.appliedTags;

  const supportPost = await SupportPost.findOne({
    postId: message.channel.id,
  });
  if (!supportPost || supportPost.closedAt) return;

  if (tags.includes(config.supportTags.unsolved)) {
    if (supportPost.author != message.author.id)
      await message.channel.setAppliedTags(
        tags.filter((t) => t !== config.supportTags.unsolved)
      );
  }

  if (supportPost.remindedAt) {
    await supportPost.updateOne({ remindedAt: null });
  }
}
