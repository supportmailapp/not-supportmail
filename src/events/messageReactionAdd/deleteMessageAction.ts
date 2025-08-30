import { MessageReaction, MessageReactionEventDetails, User } from "discord.js";
import { SupportPost } from "../../models/supportPost.js";

const ignoredChannelIds = new Set<string>();

/**
 * Determines if the reaction should be ignored based on validation criteria.
 */
function shouldCancel(reaction: MessageReaction): boolean {
  if (reaction.emoji.name !== "🗑️" && reaction.emoji.name !== "❌") return true;
  if (reaction.message.author?.id !== reaction.client.user.id) return true;
  if (ignoredChannelIds.has(reaction.message.channelId)) return true;

  return false;
}

/**
 * Deletes bot messages when users react with delete emojis.
 *
 * Listens for 🗑️ or ❌ reactions on bot messages and deletes them if:
 * - The message is from this bot
 * - An active support post exists for the channel
 * - The channel isn't in the ignore list
 *
 * Channels without support posts or with closed posts are ignored to optimize performance.
 */
export default async function (
  reaction: MessageReaction,
  _1: User,
  _2: MessageReactionEventDetails
) {
  if (shouldCancel(reaction)) return;

  const post = await SupportPost.findOne({
    postId: reaction.message.channelId,
  });
  if (!post || !!post.closedAt) {
    ignoredChannelIds.add(reaction.message.channelId);
    return;
  }
  await reaction.message.delete();
}
