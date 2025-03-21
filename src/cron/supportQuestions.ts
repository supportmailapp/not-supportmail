// Cronjob!

import * as Sentry from "@sentry/node";
import dayjs from "dayjs";
import { DiscordAPIError, REST, Routes } from "discord.js";
import { MongoClient } from "mongodb";
import config from "../config.js";
import { ISupportPost } from "../models/supportPost.js";

// Constants
const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN!);
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
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection<ISupportPost>("supportPosts");

    // 1. Find all posts that need reminders (inactive for 24h, not reminded yet, not closed, no reminder ignore)
    const postsToRemind = await collection
      .find({
        $and: [
          { lastActivity: { $lte: dayjs().subtract(1, "day").toDate() } },
          { remindedAt: null },
          { closedAt: null },
          { "ignoreFlags.reminder": { $ne: true } },
        ],
      })
      .toArray();

    // 2. Send reminders to these posts
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

    // 3. Find all posts to close (reminded > 24h ago, not closed, no close ignore, no noArchive flag)
    const postsToClose = await collection
      .find({
        $and: [
          { remindedAt: { $lte: dayjs().subtract(1, "day").toDate() } },
          { closedAt: null },
          { "ignoreFlags.close": { $ne: true } },
          { "flags.noArchive": { $ne: true } },
        ],
      })
      .toArray();

    // 4. Close these posts
    for (const post of postsToClose) {
      await rest
        .patch(Routes.channel(post.postId), {
          body: {
            available_tags: [config.tags.solved],
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
