// Cronjob!

import * as Sentry from "@sentry/node";
import dayjs from "dayjs";
import { DiscordAPIError, REST, Routes } from "discord.js";
import config from "../config.js";
import { SupportPost } from "../models/supportPost.js";
import schedule from "node-schedule";

// Constants
const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN!);
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

export async function startSupportPostSyncCron() {
  schedule.scheduleJob("0 * * * *", processSupportPostsWithRetry);
}

export async function processSupportPostsWithRetry(): Promise<void> {
  try {
    const BATCH_SIZE = 20;
    let reminderProcessedCount = 0;
    let closeProcessedCount = 0;

    // Process reminders in batches
    while (true) {
      const postsToRemind = await SupportPost.find(
        {
          $and: [
            { lastActivity: { $lte: dayjs().subtract(1, "day").toDate() } },
            { remindedAt: null },
            { closedAt: null },
            { "ignoreFlags.reminder": { $ne: true } },
          ],
        },
        null,
        {
          limit: BATCH_SIZE,
          sort: { lastActivity: 1 },
        }
      );

      if (postsToRemind.length === 0) break;

      // Send reminders with concurrency limit
      const reminderPromises = postsToRemind.map((post) =>
        rest
          .post(Routes.channelMessages(post.postId), {
            body: {
              content: getRandomReminder(post.author),
            },
          })
          .then(async () => {
            await SupportPost.updateOne(
              { postId: post.postId },
              { $set: { remindedAt: new Date() } }
            );
          })
          .catch(async (e) => {
            if (e instanceof DiscordAPIError && e.status === 404) {
              await SupportPost.deleteOne({ postId: post.postId });
            }
          })
      );

      await Promise.allSettled(reminderPromises);
      reminderProcessedCount += reminderPromises.length;

      if (postsToRemind.length < BATCH_SIZE) break;
    }

    // Process closures in batches
    while (true) {
      const postsToClose = await SupportPost.find(
        {
          $and: [
            { remindedAt: { $lte: dayjs().subtract(1, "day").toDate() } },
            { closedAt: null },
            { "ignoreFlags.close": { $ne: true } },
            { "flags.noArchive": { $ne: true } },
          ],
        },
        null,
        {
          limit: BATCH_SIZE,
          sort: { remindedAt: 1 },
        }
      );

      if (postsToClose.length === 0) break;

      // Close posts with concurrency limit
      const closePromises = postsToClose.map((post) =>
        rest
          .patch(Routes.channel(post.postId), {
            body: {
              available_tags: [config.tags.solved],
            },
          })
          .then(async () => {
            await SupportPost.updateOne(
              { postId: post.postId },
              { $set: { closedAt: new Date() } }
            );
          })
          .catch(async (e) => {
            if (e instanceof DiscordAPIError && e.status === 404) {
              await SupportPost.deleteOne({ postId: post.postId });
            }
          })
      );

      await Promise.allSettled(closePromises);
      closeProcessedCount += postsToClose.length;

      if (postsToClose.length < BATCH_SIZE) break;
    }

    console.log(
      `Processed ${reminderProcessedCount} reminders and ${closeProcessedCount} closures`
    );
  } catch (error) {
    console.error("Error processing support posts:", error);
    Sentry.captureException(error, {
      level: "error",
    });
  }
}
