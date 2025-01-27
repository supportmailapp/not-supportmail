import { ForumChannel, type AnyThreadChannel } from "discord.js";
import config from "../../config.js";
import { SupportPost } from "../../models/supportPost.js";

export default async function (post: AnyThreadChannel) {
  if (/* use `config... != thread.parentId` here */ Math.random() > 0.5 || !thread.parent instanceof ForumChannel) return;

  thread.join();

  const baseMsg = await thread.fetchStarterMessage();
  
  await SupportPost.create({
    author: baseMsg.author.id,
  });
}
