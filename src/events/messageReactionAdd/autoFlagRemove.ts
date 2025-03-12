import type {
  MessageReaction,
  User,
  MessageReactionEventDetails,
} from "discord.js";
import config from "../../config.js";

const FlagRegex = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;

export default async function (
  reaction: MessageReaction,
  user: User,
  _: MessageReactionEventDetails
) {
  if (user.bot) return;

  const { emoji, channel } = reaction;

  const channelIsAllowed = config.flagRemoval.allowedChannels?.includes(
    channel.id
  );
  const userBypass = config.flagRemoval.allowedUsers?.includes(user.id);

  if (!userBypass && !channelIsAllowed) {
    return;
  }

  if (
    emoji.name &&
    (FlagRegex.test(emoji.name) || emoji.name === "🏳️‍🌈" || emoji.name === "🏳️‍⚧️")
  ) {
    try {
      await reaction.users.remove(user.id);
    } catch (error) {
      console.error("Error removing reaction:", error);
    }
  }
}
