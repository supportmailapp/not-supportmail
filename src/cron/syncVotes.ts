import * as Sentry from "@sentry/node";
import { REST, Routes } from "discord.js";
import type { IBotVote } from "supportmail-types";
import schedule from "node-schedule";
import { BotVote } from "../models/botVote.js";

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN!);

Sentry.init({ dsn: process.env.SENTRY_DSN });

export async function startVoteSyncCron() {
  schedule.scheduleJob("0 * * * *", syncVotes);
  Sentry.logger.info("Vote sync cron started");
}

export async function syncVotes() {
  try {
    const BATCH_SIZE = 50;
    let processedCount = 0;

    while (true) {
      // Process in batches to avoid loading all data into memory
      const votesToRemove = await BotVote.find(
        {
          $and: [
            { hasRole: true },
            { removeRoleBy: { $exists: true } },
            { removeRoleBy: { $lte: new Date() } },
          ],
        },
        null,
        {
          limit: BATCH_SIZE,
          sort: { removeRoleBy: 1 },
        }
      );

      if (votesToRemove.length === 0) break;

      // Get unique user IDs in this batch
      const uniqueUserIds = votesToRemove.reduce(
        (acc: string[], vote: IBotVote) => {
          if (!acc.includes(vote.userId)) {
            acc.push(vote.userId);
          }
          return acc;
        },
        [] as string[]
      );

      if (uniqueUserIds.length === 0) break;

      // Remove roles with concurrency limit
      const rolePromises = uniqueUserIds.map(
        (userId) =>
          rest
            .delete(
              Routes.guildMemberRole(
                process.env.GUILD_ID!,
                userId,
                process.env.ROLE_VOTER!
              )
            )
            .catch(() => {}) // Ignore errors
      );

      await Promise.allSettled(rolePromises);

      // Delete processed votes
      await BotVote.deleteMany({
        userId: { $in: uniqueUserIds },
      });

      processedCount += uniqueUserIds.length;

      // If we got fewer results than batch size, we're done
      if (votesToRemove.length < BATCH_SIZE) break;
    }

    Sentry.logger.debug(`Processed votes`, {
      processedCount,
    });
  } catch (error) {
    console.error("Error processing support posts:", error);
    Sentry.captureException(error, {
      level: "error",
    });
  }
}
