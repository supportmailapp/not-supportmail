import * as Sentry from "@sentry/node";
import { VoiceState } from "discord.js";
import { type HydratedDocument } from "mongoose";
import NodeCache from "node-cache";
import { scheduleJob } from "node-schedule";
import {
  TempChannel,
  type ITempChannelCategory,
} from "../../models/tempChannel.js";
import { createAndSaveTempChannel } from "../../utils/tempChannels.js";
import dayjs from "dayjs";

/**
 * Simplified cache for user count data only.
 * All user counts are stored here and periodically synced to database.
 */
const cache = new NodeCache({
  errorOnMissing: false,
  checkperiod: 0, // Disable automatic cleanup
  useClones: false,
});

/**
 * Cache for tracking users who recently disconnected.
 * Key: `${guildId}-${userId}`, Value: timestamp of disconnect
 */
const disconnectCache = new NodeCache({
  errorOnMissing: false,
  stdTTL: 5, // 5 second TTL for disconnect tracking
  checkperiod: 2,
  useClones: false,
});

// Set to track which channels have been modified and need database updates
const modifiedChannels = new Set<string>();

/**
 * Scheduled job to update database with cached user counts every 10 seconds
 */
const databaseUpdateJob = scheduleJob("*/10 * * * * *", async () => {
  if (modifiedChannels.size === 0) {
    console.debug(
      "[TempChannel] No modified channels, skipping database update"
    );
    return;
  }

  console.debug(
    `[TempChannel] Updating database for ${modifiedChannels.size} modified channels`
  );

  const channelsToUpdate = Array.from(modifiedChannels);
  modifiedChannels.clear();

  const updatePromises = channelsToUpdate.map(async (cacheKey) => {
    const userCount = cache.get<number>(cacheKey);
    if (userCount === undefined) {
      console.debug(
        `[TempChannel] Cache miss during scheduled update for ${cacheKey}`
      );
      return;
    }

    const [guildId, channelId] = cacheKey.split("-");

    try {
      await TempChannel.updateOne(
        { channelId, guildId },
        { $set: { userCount } }
      );
      console.debug(
        `[TempChannel] Updated database user count to ${userCount} for channel ${channelId}`
      );
    } catch (error) {
      console.error(
        `[TempChannel] Error updating database for channel ${channelId}:`,
        error
      );
      Sentry.captureException(error);
      // Re-add to modified channels for retry
      modifiedChannels.add(cacheKey);
    }
  });

  await Promise.all(updatePromises);
});

/**
 * Get user count with cache-first approach
 */
async function getUserCount(
  channelId: string,
  guildId: string,
  fallbackChannel?: VoiceState["channel"]
): Promise<number> {
  const cacheKey = `${guildId}-${channelId}`;

  // Always update cache with fresh Discord data if available
  if (fallbackChannel?.members) {
    const count = fallbackChannel.members.size;
    console.debug(
      `[TempChannel] Updating cache with fresh Discord count for ${channelId}: ${count}`
    );
    cache.set(cacheKey, count);
    modifiedChannels.add(cacheKey);
    return count;
  }

  // Try cache first
  const cachedCount = cache.get<number>(cacheKey);
  if (cachedCount !== undefined) {
    console.debug(
      `[TempChannel] Cache hit for user count: ${channelId} = ${cachedCount}`
    );
    return cachedCount;
  }

  // Cache miss - query database
  console.debug(
    `[TempChannel] Cache miss for user count, querying database for channel ${channelId}`
  );

  const tempChannel = await TempChannel.findOne({
    channelId,
    guildId,
  });

  const count = tempChannel?.userCount || 0;

  // Cache the database result
  cache.set(cacheKey, count);
  console.debug(
    `[TempChannel] Cached database user count for ${channelId}: ${count}`
  );

  return count;
}

/**
 * New approach: Calculate empty channels by checking cached counts first,
 * then falling back to database for missing data
 */
async function getEmptyChannelCount(
  guildId: string,
  categoryId: string
): Promise<number> {
  console.debug(
    `[TempChannel] Calculating empty channels for category ${categoryId}`
  );

  // Get all temp channels in the category
  const tempChannels = await TempChannel.find(
    {
      guildId,
      category: categoryId,
    },
    { channelId: 1, userCount: 1 }
  );

  let emptyCount = 0;

  for (const channel of tempChannels) {
    const cacheKey = `${guildId}-${channel.channelId}`;
    const cachedCount = cache.get<number>(cacheKey);

    // Use cached count if available, otherwise use database value
    const userCount =
      cachedCount !== undefined ? cachedCount : channel.userCount;

    if (userCount === 0) {
      emptyCount++;
    }
  }

  console.debug(
    `[TempChannel] Found ${emptyCount} empty channels in category ${categoryId}`
  );
  return emptyCount;
}

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  const userId = oldState.member?.user.id;
  if (!userId) return;

  console.debug(
    `[TempChannel] Handling user leave from channel ${oldState.channel.id} in guild ${oldState.guild.id}`
  );

  // Check if user has a recent disconnect entry to prevent infinite loops
  const disconnectKey = `${oldState.guild.id}-${userId}`;
  const recentDisconnect = disconnectCache.get<number>(disconnectKey);

  if (recentDisconnect) {
    console.debug(
      `[TempChannel] User ${userId} has recent disconnect entry, skipping to prevent loops`
    );
    return;
  }

  // Mark user as recently disconnected
  disconnectCache.set(disconnectKey, dayjs().unix());
  console.debug(`[TempChannel] Marked user ${userId} as recently disconnected`);

  // Check if this is a temp channel
  const tempChannelDoc = await TempChannel.findOne({
    channelId: oldState.channel.id,
    guildId: oldState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannelDoc) {
    console.debug(
      `[TempChannel] Channel ${oldState.channel.id} is not a temporary channel`
    );
    return;
  }

  // Get current user count and update cache
  const newUserCount = await getUserCount(
    oldState.channel.id,
    oldState.guild.id,
    oldState.channel
  );

  console.debug(
    `[TempChannel] Current user count after leave: ${newUserCount} for channel ${oldState.channel.id}`
  );

  // If the channel is now empty, check for cleanup
  if (newUserCount <= 0) {
    console.debug(
      `[TempChannel] Channel ${oldState.channel.id} is empty, scheduling cleanup check`
    );

    // Add delay to prevent race conditions
    setTimeout(async () => {
      try {
        console.debug(
          `[TempChannel] Executing cleanup check for channel ${
            oldState.channel!.id
          }`
        );

        // Double-check the count after delay
        const finalUserCount = await getUserCount(
          oldState.channel!.id,
          oldState.guild!.id,
          oldState.channel
        );

        if (finalUserCount > 0) {
          console.debug(
            `[TempChannel] Channel ${
              oldState.channel!.id
            } no longer empty, skipping cleanup`
          );
          return;
        }

        // Get empty channel count using new approach
        const emptyChannelCount = await getEmptyChannelCount(
          oldState.guild!.id,
          tempChannelDoc.category._id.toHexString()
        );

        console.debug(
          `[TempChannel] Found ${emptyChannelCount} empty channels in category`
        );

        // Only delete if there are multiple empty channels
        if (emptyChannelCount > 1) {
          // Find the highest numbered empty channel to delete
          const emptyChannelsInCategory = await TempChannel.find(
            {
              guildId: oldState.guild!.id,
              category: tempChannelDoc.category._id,
            },
            { channelId: 1, number: 1 }
          ).sort({ number: -1 });

          // Filter by cached user counts
          const emptyChannels = [];
          for (const channel of emptyChannelsInCategory) {
            const cacheKey = `${oldState.guild!.id}-${channel.channelId}`;
            const cachedCount = cache.get<number>(cacheKey);
            const userCount = cachedCount !== undefined ? cachedCount : 0;

            if (userCount === 0) {
              emptyChannels.push(channel);
            }
          }

          if (emptyChannels.length > 1) {
            const toDeleteChannelId = emptyChannels[0].channelId;
            console.debug(
              `[TempChannel] Deleting excess empty channel: ${toDeleteChannelId}`
            );

            try {
              await oldState.guild!.channels.delete(
                toDeleteChannelId,
                "Temporary channel cleanup - multiple empty channels"
              );
              await TempChannel.deleteOne({ channelId: toDeleteChannelId });

              // Clear cache for deleted channel
              const cacheKey = `${oldState.guild!.id}-${toDeleteChannelId}`;
              cache.del(cacheKey);
              modifiedChannels.delete(cacheKey);

              console.debug(
                `[TempChannel] Successfully deleted temporary channel: ${toDeleteChannelId}`
              );
              Sentry.logger.debug(
                `Deleted empty temporary channel: ${oldState.channel?.name}`
              );
            } catch (error) {
              console.error(
                `[TempChannel] Error deleting channel ${toDeleteChannelId}:`,
                error
              );
              Sentry.captureException(error);
            }
          }
        } else {
          console.debug(
            `[TempChannel] Only ${emptyChannelCount} empty channel(s) in category, keeping channel`
          );
        }
      } catch (error) {
        console.error(`[TempChannel] Error in cleanup check:`, error);
        Sentry.captureException(error);
      }
    }, 2000);
  }
}

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  console.debug(
    `[TempChannel] Handling user join to channel ${newState.channel.id} in guild ${newState.guild.id}`
  );

  // Check if this is a temp channel
  const tempChannelDoc = await TempChannel.findOne({
    channelId: newState.channel.id,
    guildId: newState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannelDoc) {
    console.debug(
      `[TempChannel] Channel ${newState.channel.id} is not a temporary channel`
    );
    return;
  }

  if (disconnectCache.has(`${newState.guild.id}-${newState.member?.user.id}`)) {
    await newState.setChannel(null, "Disconnect due to recent leave");
    disconnectCache.set(
      `${newState.guild.id}-${newState.member?.user.id}`,
      dayjs().unix()
    );
    console.debug(
      `[TempChannel] User ${newState.member?.user.id} recently disconnected, resetting channel`
    );
    await newState.member
      ?.send(
        `:warning: Please wait a moment before rejoining. Try again <t:${dayjs()
          .add(5, "s")
          .unix()}:R>`
      )
      .catch(() => {});
    return;
  }

  // Update user count in cache
  await getUserCount(newState.channel.id, newState.guild.id, newState.channel);

  // Check category limits
  const [totalChannels, emptyChannelCount] = await Promise.all([
    TempChannel.countDocuments({
      guildId: newState.guild.id,
      category: tempChannelDoc.category._id,
    }),
    getEmptyChannelCount(
      newState.guild.id,
      tempChannelDoc.category._id.toHexString()
    ),
  ]);

  console.debug(
    `[TempChannel] Category stats: ${totalChannels} total, ${emptyChannelCount} empty`
  );

  // Check max channel limit
  if (
    tempChannelDoc.category.maxChannels &&
    totalChannels >= tempChannelDoc.category.maxChannels
  ) {
    console.debug(
      `[TempChannel] Category at max channels, not creating new channel`
    );
    return;
  }

  // Create new channel if no empty channels available
  if (emptyChannelCount === 0) {
    console.debug(
      `[TempChannel] No empty channels available, creating new channel`
    );
    await createAndSaveTempChannel(
      newState.guild,
      tempChannelDoc.category,
      tempChannelDoc.category.parentId,
      true
    );
    console.debug(`[TempChannel] Created new temp channel for category`);
  } else {
    console.debug(
      `[TempChannel] ${emptyChannelCount} empty channel(s) available, no new channel needed`
    );
  }
}

// Clean up cache when channels are deleted externally
export function cleanupChannelCache(guildId: string, channelId: string) {
  const cacheKey = `${guildId}-${channelId}`;
  cache.del(cacheKey);
  modifiedChannels.delete(cacheKey);
  console.debug(
    `[TempChannel] Cleaned up cache for deleted channel: ${channelId}`
  );
}

// Main event handler
export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
    const userId = newState.member?.user.id || oldState.member?.user.id;
    const guildId = newState.guild.id;

    console.debug(
      `[TempChannel] Voice state update for user ${userId} in guild ${guildId}`
    );
    console.debug(
      `[TempChannel] Old channel: ${oldState.channel?.id}, New channel: ${newState.channel?.id}`
    );

    // User left a channel
    if (
      oldState.channel &&
      (!newState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      console.debug(
        `[TempChannel] User ${userId} left channel ${oldState.channel.id}`
      );
      await handleUserLeave(oldState);
    }

    // User joined a channel
    if (
      newState.channel &&
      (!oldState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      console.debug(
        `[TempChannel] User ${userId} joined channel ${newState.channel.id}`
      );
      await handleUserJoin(newState);
    }

    console.debug(
      `[TempChannel] Voice state update completed for user ${userId}`
    );
  } catch (error) {
    console.error(`[TempChannel] Error handling voice state update:`, error);
    Sentry.captureException(error);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.debug("[TempChannel] Shutting down, canceling scheduled job");
  databaseUpdateJob.cancel();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.debug("[TempChannel] Shutting down, canceling scheduled job");
  databaseUpdateJob.cancel();
  process.exit(0);
});
