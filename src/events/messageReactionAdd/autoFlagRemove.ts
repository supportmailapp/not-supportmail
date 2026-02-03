import type {
  MessageReaction,
  MessageReactionEventDetails,
  User,
} from "discord.js";
import config from "../../config.js";

const { flagRemoval: _config } = config;

const FlagRegex = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;

export async function autoFlagRemove(
  reaction: MessageReaction,
  user: User,
  _: MessageReactionEventDetails
) {
  if (user.bot) return;

  const {
    emoji,
    message: { channelId },
  } = reaction;

  const channelIsAllowed = _config.allowedChannels?.includes(channelId);
  const userBypass = _config.allowedUsers?.includes(user.id);

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
