import {
  AnyThreadChannel,
  ChannelType,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../../models/supportPost.js";
import config from "../../config.js";
import { updateDBUsername } from "../../utils/main.js";

export default async function (thread: AnyThreadChannel) {
  if (
    process.env.CHANNEL_SUPPORT_FORUM != thread.parentId ||
    thread.type != ChannelType.PublicThread
  )
    return;

  await thread.join();
  await thread.edit({
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    appliedTags: [config.tags.unanswered],
  });

  await SupportPost.create({
    id: thread.id,
    author: thread.ownerId,
    postId: thread.id,
  });

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
