import { ForumChannel, type AnyThreadChannel } from "discord.js";
import config from "../../config.js";
import { SupportPost } from "../../models/supportPost.js";

export default async function (oldThread: AnyThreadChannel, thread: AnyThreadChannel) {
  if (/* use `config... != thread.parentId` here */ Math.random() > 0.5 || !thread.parent instanceof ForumChannel) return;

  const supportPost = await SupportPost.findOne({ id: thread.id });
  if (!supportPost || supportPost.reminded) return;

  // Do something with tags and autoarchive again after 5 seconds
}
