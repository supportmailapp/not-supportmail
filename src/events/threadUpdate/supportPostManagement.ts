import type { AnyThreadChannel } from "discord.js";
import { SupportPost } from "../../models/supportPost.js";
import config from "../../config.js";
import PostArchiveCache from "../../caches/supportPostsArchive.js";
import { delay } from "../../utils/main.js";
import dayjs from "dayjs";

const reminders = [
  (u: string) =>
    `### Hi <@${u}>!\n> Your last message is about 24 hours old.\n> Let us know if there's anything else we can do. If we don't hear back from you, this post will automatically be archived. Reach out if you still need help.`,
  (u: string) =>
    `### Hey <@${u}>!\n> It's been a day since your last message.\n> We'll close this post in 24 hours if we don't hear back from you. Let us know if you need more help.`,
  (u: string) =>
    `### Gday <@${u}>!\n> It's been a day since your last message.\n> This post will be automatically after the next 24 hours if we don't hear from you. Let us know if you need further assistance.`,
];

// random because of ratelimits
function getRandomReminder(uid: string) {
  return reminders[~~(Math.random() * reminders.length)](uid);
}

export default async function (
  oldThread: AnyThreadChannel,
  thread: AnyThreadChannel
) {
  if (
    config.supportForumId !== thread.parentId ||
    !thread.parent.isThreadOnly()
  )
    return;

  const supportPost = await SupportPost.findOne({ id: thread.id });
  if (!supportPost) return;

  if (
    supportPost.remindedAt == null &&
    supportPost.ignoreFlags?.reminder == true
  ) {
    await thread.send(getRandomReminder(supportPost.author));

    await supportPost.updateOne({ remindedAt: dayjs().toDate() });
    return;
  }

  if (oldThread.archived == thread.archived) return;

  if (PostArchiveCache.get(thread.id)) {
    // If the post is already archived, we need to be sure that we don't update it again because this event could also be sent if the client archives the post.
    await delay(3000);
    const alreadyClosed = await SupportPost.findOne({ id: thread.id });
    if (alreadyClosed?.closedAt) return;
  }

  await supportPost.updateOne({ closedAt: dayjs().toDate() });
  PostArchiveCache.set(thread.id);

  await thread.setAppliedTags(
    thread.appliedTags.concat(config.supportTags.resolved)
  );
  await delay(500);

  await thread.setArchived(true, "Closed due to inactivity"); // This triggers the threadUpdate event again
}
