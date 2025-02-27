// Cronjob!

import { MongoClient } from "mongodb";
import * as Sentry from "@sentry/node";
import { ISupportPost } from "../models/supportPost.js";
import dayjs from "dayjs";
import { DiscordAPIError, REST, Routes } from "discord.js";
const config = (await import("../../config.json", { with: { type: "json" } }))
  .default;

// Constants
const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
const maxRetries = 3;
const retryDelay = 5000;
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

Sentry.init({ dsn: process.env.SENTRY_DSN });

async function updateMongoDBWithRetry(retries = 0) {
  const client = new MongoClient(process.env.MONGO_URI);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection<ISupportPost>("supportPosts");

    // 1. Find all posts that are older than 24 hours, not closed
    const result = await collection
      .find({
        $and: [
          { lastActivity: { $lte: dayjs().subtract(1, "day").toDate() } },
          { closedAt: { $exists: false } },
        ],
      })
      .toArray();

    // 2. Filter the posts that have not been reminded yet
    const postsToRemind = result.filter(
      (post) => post.remindedAt == null && post.ignoreFlags?.reminder != true
    );
    const remindIds = postsToRemind.map((p) => p.postId);

    // 3. Filter out the posts that have been reminded
    const postsToClose = result
      .filter((p) => !remindIds.includes(p.postId)) // Just to be sure we don't close posts that have just been reminded (Fail-safe)
      .filter(
        (post) =>
          post.remindedAt != null &&
          post.ignoreFlags?.close != true &&
          post.flags.noArchive != true
      );

    // 4. Send reminders
    for (const post of postsToRemind) {
      await rest
        .post(Routes.channelMessages(post.postId), {
          body: {
            content: getRandomReminder(post.author),
          },
        })
        .then(async () => {
          await collection.updateOne(
            { postId: post.postId },
            { $set: { remindedAt: new Date() } }
          );
        })
        .catch(async (e) => {
          if (e instanceof DiscordAPIError) {
            if (e.status == 404) {
              await collection.deleteOne({ postId: post.postId });
            }
          }
        });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 5. Close other posts
    for (const post of postsToClose) {
      await rest
        .patch(Routes.channel(post.postId), {
          body: {
            available_tags: [config.supportTags.resolved],
          },
        })
        .then(async () => {
          await collection.updateOne(
            { postId: post.postId },
            { $set: { closedAt: new Date() } }
          );
        })
        .catch(async (e) => {
          if (e instanceof DiscordAPIError) {
            if (e.status == 404) {
              await collection.deleteOne({ postId: post.postId });
            }
          }
        });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    Sentry.captureException(error, {
      level: "debug",
    });

    if (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      await updateMongoDBWithRetry(retries + 1);
    } else {
      Sentry.captureException(error, {
        level: "error",
      });
    }
  } finally {
    await client.close();
  }
}

await updateMongoDBWithRetry(3).catch();
