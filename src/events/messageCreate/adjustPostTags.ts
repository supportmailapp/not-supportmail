/**
 * Adjusts the tags of a post based on the message author.
 */

import { ChannelType, Message } from "discord.js";
import { SupportQuestion } from "../../models/supportQuestion.js";

const { supportForumId, supportTags } = (
  await import("../../../config.json", { with: { type: "json" } })
).default;

export default async function adjustPostTags(message: Message) {
  if (
    message.channel.isDMBased() ||
    !(
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
    ) ||
    message.channel.parentId !== supportForumId ||
    message.channel.parent?.type !== ChannelType.GuildForum ||
    message.author.bot
  )
    return;

  const tags = message.channel.appliedTags;

  if (!tags.includes(supportTags.unsolved)) return;

  const supportIssue = await SupportQuestion.findOne({
    postId: message.channel.id,
  });

  if (!supportIssue || supportIssue.userId != message.author.id) return;

  await message.channel.setAppliedTags([supportTags[supportIssue._type]]);
}
