/**
 * Adjusts the tags of a post based on the message author.
 */

import { ChannelType, Message } from "discord.js";
import { SupportQuestion } from "../../models/supportQuestion.js";
import dayjs from "dayjs";

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

  const supportIssue = await SupportQuestion.findOne({
    postId: message.channel.id,
  });

  if (tags.includes(supportTags.unsolved)) {
    if (!supportIssue || supportIssue.userId != message.author.id) return;

    if (supportIssue.state == "unsolved")
      await message.channel.setAppliedTags([supportTags[supportIssue._type]]);
  }

  let updateFields = { lastActivity: dayjs().toDate() };

  if (supportIssue.flags.reminded) updateFields["flags.reminded"] = false;

  await supportIssue.updateOne(updateFields);
}
