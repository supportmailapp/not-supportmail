import { type AnyThreadChannel, ChannelType } from "discord.js";
import { delay, updateDBUsername } from "../../utils/main.js";
import { SupportPost } from "../../models/supportPosts.js";

export async function supportPostCreate(thread: AnyThreadChannel) {
  if (
    thread.type != ChannelType.PublicThread ||
    Bun.env.CHANNEL_SUPPORT_FORUM != thread.parentId
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
      true,
    );
  }

  // Pin the starter message (has the same ID as the thread)
  await thread.messages.pin(thread.id);

  await delay(1000); // Wait a bit, so the rescheduler doesn't immediately run before the post is created in the DB

  await SupportPost.updateOne(
    {
      postId: thread.id,
      userId: thread.ownerId,
    },
    {
      postId: thread.id,
      userId: thread.ownerId,
    },
    { upsert: true },
  );
}
