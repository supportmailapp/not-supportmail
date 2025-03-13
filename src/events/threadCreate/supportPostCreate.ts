import {
  AnyThreadChannel,
  ChannelType,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../../models/supportPost.js";
import config from "../../config.js";

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
}
