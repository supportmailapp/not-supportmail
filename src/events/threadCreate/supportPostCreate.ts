import { type AnyThreadChannel, ChannelType } from "discord.js";
import { updateDBUsername } from "../../utils/main.js";

export default async function (thread: AnyThreadChannel) {
  if (
    thread.type != ChannelType.PublicThread ||
    process.env.CHANNEL_SUPPORT_FORUM != thread.parentId
  ) {
    return;
  }

  await thread.join();

  const owner = await thread.guild.members
    .fetch(thread.ownerId)
    .catch(() => null);

  if (owner) {
    await updateDBUsername(
      {
        id: owner.id,
        username: owner.user.username,
        displayName: owner.displayName || owner.user.displayName,
      },
      true
    );
  }

  // Pin the starter message (has the same ID as the thread)
  await thread.messages.pin(thread.id);
}
