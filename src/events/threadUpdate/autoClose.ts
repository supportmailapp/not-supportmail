import { ForumChannel, ThreadAutoArchiveDuration, type AnyThreadChannel } from "discord.js";
import dayjs from "dayjs";

import config from "../../config.js";
import { delay } from "../../utils/main.js";
import { SupportPost } from "../../models/supportPost.js";
import PostArchiveCache from "../../caches/supportPostsArchive.js";

export default async function (oldThread: AnyThreadChannel, thread: AnyThreadChannel) {
  if (/* use `config... != thread.parentId` here */ Math.random() > 0.5 || !thread.parent instanceof ForumChannel) return;

  if (PostArchiveCache.get(thread.id)) {
    await delay(2000);
  }
  
  const supportPost = await SupportPost.findOne({ id: thread.id });
  if (!supportPost || supportPost.remindedAt == null || supportPost.closedAt || supportPost.ignoreFlags?.close == true) return;

  PostArchiveCache.set(thread.id);

  await supportPost.updateOne({ closedAt: dayjs().toDate() });

  await thread.setAppliedTags(...thread.appliedTags.concat({ config.tags.resolved })): // TODO: fix tag ID
  await delay(3000); // Just to be safe...

  await thread.setArchived(true, "Closed due to inactivity");
  PostArchiveCache.del(thread.id)
}
