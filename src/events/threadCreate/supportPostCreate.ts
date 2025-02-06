import {
  AnyThreadChannel,
  ChannelType,
  ThreadAutoArchiveDuration,
} from "discord.js";
import config from "../../config.js";
import { SupportPost } from "../../models/supportPost.js";

export default async function (thread: AnyThreadChannel) {
  if (
    config.supportForumId != thread.parentId ||
    thread.type != ChannelType.PublicThread
  )
    return;

  await thread.join();
  await thread.edit({
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    appliedTags: [config.supportTags.unanswered],
  });

  await SupportPost.create({
    id: thread.id,
    author: thread.ownerId,
    postId: thread.id,
  });
}
