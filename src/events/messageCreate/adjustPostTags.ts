import { ChannelType, Message } from "discord.js";

import { SupportPost } from "../../models/supportPost.js";
import config from "../../config.js";
import { updateDBUsername } from "../../utils/main.js";

/**
 * Adjusts exchanges the `Unanswered` tag for the `Unsolved` tag if the message is sent in a support thread.
 */
export default async function adjustPostTags(message: Message) {
  if (
    message.inGuild() &&
    message.channel.type === ChannelType.PublicThread &&
    message.channel.parentId === process.env.CHANNEL_SUPPORT_FORUM &&
    message.author.bot === false
  ) {
    const supportPost = await SupportPost.findOne({
      postId: message.channel.id,
    });
    if (!supportPost || !!supportPost.closedAt) {
      return;
    }

    // Always update lastActivity for any message in the thread
    let updateQuery = { $set: { lastActivity: new Date() } } as any;
    
    // If this is the author responding after being reminded, clear the reminder
    if (message.author.id === supportPost.author && supportPost.remindedAt) {
      updateQuery["$set"]["remindedAt"] = null;
    }

    await supportPost.updateOne(updateQuery);

    // If the message is from the author, we're done (no tag changes needed)
    if (message.author.id === supportPost.author) {
      return;
    }

    // Handle tag changes for non-author messages
    const tags = message.channel.appliedTags;
    if (tags.includes(process.env.TAG_UNANSWERED!)) {
      // Keep any other tags that are used for management and add the unsolved tag
      await message.channel.setAppliedTags([
        ...tags.filter((tid) => !Object.values(config.tags).includes(tid)),
        process.env.TAG_UNSOLVED!,
      ]);
    }

    if (!supportPost.users.includes(message.author.id)) {
      await supportPost.updateOne({ $push: { users: message.author.id } });
    }

    await updateDBUsername({
      id: message.author.id,
      username: message.author.username,
      displayName: message.member
        ? message.member.displayName
        : message.author.displayName,
    });
  }
}