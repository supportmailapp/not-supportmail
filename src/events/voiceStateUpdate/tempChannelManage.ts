import * as Sentry from "@sentry/node";
import { VoiceState } from "discord.js";
import type { HydratedDocument } from "mongoose";
import NodeCache from "node-cache";
import {
  ITempChannel,
  ITempChannelCategory,
  TempChannel,
} from "../../models/tempChannel.js";
import { createAndSaveTempChannel } from "../../utils/tempChannels.js";

type CachedTempChannel = Record<string, any> &
  Omit<ITempChannel, "category"> & { id: string } & {
    category: ITempChannelCategory & { id: string };
  };

function TempChannelDocToCached(
  doc: HydratedDocument<Omit<ITempChannel, "category">> & {
    category: HydratedDocument<ITempChannelCategory>;
  }
): CachedTempChannel {
  console.debug(
    `[TempChannel] Converting document to cached format for channel ${doc.channelId}`
  );
  return {
    ...doc.toJSON({ versionKey: false, flattenObjectIds: true }),
    id: doc._id.toHexString(),
    category: {
      ...doc.category.toJSON({ versionKey: false, flattenObjectIds: true }),
      id: doc.category._id.toHexString(),
    },
  };
}

const userCountUpdateDelay = 3; // Delay to allow for user count stabilization

/**
 * Multi-purpose cache for temporary voice channel management to reduce database operations
 * and prevent race conditions during rapid voice state changes.
 *
 * Cached data includes:
 * - `userCount-{guildId}-{channelId}`: Current user count for a channel (TTL: 3s)
 * - `tempChannel-{guildId}-{channelId}`: Full temp channel document with populated category (TTL: 5min)
 * - `categoryStats-{guildId}-{categoryId}`: Channel counts per category (totalChannels, emptyChannels) (TTL: 30s)
 *
 * This caching strategy prevents:
 * - Excessive database queries during rapid joins/leaves
 * - Race conditions when multiple users join/leave simultaneously
 * - Unnecessary channel creation/deletion operations
 * - Database write conflicts during user count updates
 *
 * Similar to how MEE6 and TempVoice bots handle voice state management.
 *
 * Yes, this was constructed with AI. It couldn't be tested due to my limited resources.
 */
const cache = new NodeCache({
  errorOnMissing: false,
  stdTTL: userCountUpdateDelay,
  checkperiod: 2,
  useClones: false,
});

// Cache pending updates to prevent race conditions
const pendingUpdates = new Map<string, NodeJS.Timeout>();

// Update user counts for channels after a voice state change with debouncing
async function updateUserCounts(
  guildId: string,
  ...voices: VoiceState["channel"][]
) {
  console.debug(
    `[TempChannel] Updating user counts for ${voices.length} channels in guild ${guildId}`
  );

  for (const voice of voices) {
    if (!voice?.members) {
      console.debug(
        `[TempChannel] Skipping voice channel with no members: ${
          voice?.id || "null"
        }`
      );
      continue;
    }

    const cacheKey = `${guildId}-${voice.id}`;
    console.debug(
      `[TempChannel] Processing user count update for channel ${voice.id}, current members: ${voice.members.size}`
    );

    // Clear any existing pending update for this channel
    if (pendingUpdates.has(cacheKey)) {
      console.debug(
        `[TempChannel] Clearing existing pending update for channel ${voice.id}`
      );
      clearTimeout(pendingUpdates.get(cacheKey)!);
    }

    // Set a new debounced update
    pendingUpdates.set(
      cacheKey,
      setTimeout(async () => {
        try {
          console.debug(
            `[TempChannel] Executing debounced user count update for channel ${voice.id}`
          );

          // Get fresh member count at time of execution
          if (!voice.members) {
            console.debug(
              `[TempChannel] No members found during debounced update for channel ${voice.id}`
            );
            return;
          }

          console.debug(
            `[TempChannel] Updating database user count to ${voice.members.size} for channel ${voice.id}`
          );

          await TempChannel.updateOne(
            {
              channelId: voice.id,
              guildId: guildId,
            },
            {
              $set: { userCount: voice.members.size },
            }
          );

          // Cache the updated count
          cache.set(`userCount-${cacheKey}`, voice.members.size, 3);
          console.debug(
            `[TempChannel] Cached user count ${voice.members.size} for channel ${voice.id}`
          );

          // Clean up
          pendingUpdates.delete(cacheKey);
        } catch (error) {
          console.error(
            `[TempChannel] Error updating user count for channel ${voice.id}:`,
            error
          );
          Sentry.captureException(error);
          pendingUpdates.delete(cacheKey);
        }
      }, userCountUpdateDelay * 1000)
    );

    console.debug(
      `[TempChannel] Scheduled debounced update for channel ${voice.id} in ${userCountUpdateDelay}s`
    );
  }
}

// Get user count with cache fallback
async function getUserCount(
  channelId: string,
  guildId: string,
  fallbackChannel?: VoiceState["channel"]
): Promise<number> {
  const cacheKey = `userCount-${guildId}-${channelId}`;
  const cachedCount = cache.get<number>(cacheKey);

  if (cachedCount !== undefined) {
    console.debug(
      `[TempChannel] Cache hit for user count: ${channelId} = ${cachedCount}`
    );
    return cachedCount;
  }

  console.debug(
    `[TempChannel] Cache miss for user count, querying database for channel ${channelId}`
  );

  // If not cached, get from database
  const tempChannel = await TempChannel.findOne({
    channelId,
    guildId,
  });

  if (tempChannel) {
    const count = tempChannel.userCount;
    cache.set(cacheKey, count, 3);
    console.debug(
      `[TempChannel] Database user count for ${channelId}: ${count} (cached)`
    );
    return count;
  }

  // Last resort: get from Discord API if channel provided
  if (fallbackChannel?.members) {
    const count = fallbackChannel.members.size;
    console.debug(
      `[TempChannel] Fallback Discord API user count for ${channelId}: ${count}`
    );
    return count;
  }

  console.debug(
    `[TempChannel] No user count found for channel ${channelId}, returning 0`
  );
  return 0;
}

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  console.debug(
    `[TempChannel] Handling user leave from channel ${oldState.channel.id} in guild ${oldState.guild.id}`
  );

  // Check cache first to avoid unnecessary DB queries
  const cacheKey = `tempChannel-${oldState.guild.id}-${oldState.channel.id}`;
  let tempChannel = cache.get<CachedTempChannel>(cacheKey);

  if (!tempChannel) {
    console.debug(
      `[TempChannel] Cache miss for temp channel, querying database: ${oldState.channel.id}`
    );

    const tempChannelDoc = await TempChannel.findOne({
      channelId: oldState.channel.id,
      guildId: oldState.guild.id,
    }).populate<{ category: HydratedDocument<ITempChannelCategory> }>(
      "category"
    );

    if (!tempChannelDoc) {
      console.debug(
        `[TempChannel] Channel ${oldState.channel.id} is not a temporary channel`
      );
      return;
    }

    tempChannel = TempChannelDocToCached(tempChannelDoc);
    // Cache the temp channel info
    cache.set(cacheKey, tempChannel, 300); // Cache for 5 minutes
    console.debug(
      `[TempChannel] Cached temp channel info for ${oldState.channel.id}`
    );
  } else {
    console.debug(
      `[TempChannel] Cache hit for temp channel: ${oldState.channel.id}`
    );
  }

  // Get current user count (with potential delay/debouncing)
  const newUserCount = await getUserCount(
    oldState.channel.id,
    oldState.guild.id,
    oldState.channel
  );

  console.debug(
    `[TempChannel] Current user count after leave: ${newUserCount} for channel ${oldState.channel.id}`
  );

  // If the channel is now empty, check if there are multiple empty channels in the same category.
  if (newUserCount <= 0) {
    console.debug(
      `[TempChannel] Channel ${oldState.channel.id} is empty, scheduling cleanup check`
    );

    // Add small delay to prevent race conditions with rapid joins/leaves
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
            } no longer empty (${finalUserCount} users), skipping cleanup`
          );
          return; // Someone joined in the meantime
        }

        console.debug(
          `[TempChannel] Finding empty channels in category ${tempChannel.category.id}`
        );

        // Find all empty channels in the category, sorted by number descending.
        const emptyChannelsInCategory = await TempChannel.find(
          {
            guildId: oldState.guild!.id,
            category: tempChannel.category.id,
            userCount: 0,
          },
          null,
          { sort: { number: -1 } }
        );

        console.debug(
          `[TempChannel] Found ${emptyChannelsInCategory.length} empty channels in category ${tempChannel.category.id}`
        );

        // Only delete if there is more than one empty channel.
        if (emptyChannelsInCategory.length > 1) {
          const toDeleteChannelId = emptyChannelsInCategory[0].channelId;
          console.debug(
            `[TempChannel] Deleting excess empty channel: ${toDeleteChannelId}`
          );

          try {
            await oldState.guild!.channels.delete(
              toDeleteChannelId,
              "Temporary channel cleanup - multiple empty channels"
            );
            await TempChannel.deleteOne({
              channelId: toDeleteChannelId,
            });

            // Clear cache for deleted channel
            cache.del(`tempChannel-${oldState.guild!.id}-${toDeleteChannelId}`);
            cache.del(`userCount-${oldState.guild!.id}-${toDeleteChannelId}`);

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
        } else {
          console.debug(
            `[TempChannel] Only ${
              emptyChannelsInCategory.length
            } empty channel(s) in category, keeping channel ${
              oldState.channel!.id
            }`
          );
        }
      } catch (error) {
        console.error(
          `[TempChannel] Error in cleanup check for channel ${
            oldState.channel!.id
          }:`,
          error
        );
        Sentry.captureException(error);
      }
    }, 2000); // 2 second delay to prevent race conditions
  }
}

// TODO: Test caching logic with multiple users joining/leaving rapidly

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  console.debug(
    `[TempChannel] Handling user join to channel ${newState.channel.id} in guild ${newState.guild.id}`
  );

  // Check cache first
  const cacheKey = `tempChannel-${newState.guild.id}-${newState.channel.id}`;
  let tempChannel = cache.get<CachedTempChannel>(cacheKey);
  let tempChannelDoc:
    | (HydratedDocument<Omit<ITempChannel, "category">> & {
        category: HydratedDocument<ITempChannelCategory>;
      })
    | null;

  if (!tempChannel) {
    console.debug(
      `[TempChannel] Cache miss for temp channel, querying database: ${newState.channel.id}`
    );

    tempChannelDoc = await TempChannel.findOne({
      channelId: newState.channel.id,
      guildId: newState.guild.id,
    }).populate<{ category: HydratedDocument<ITempChannelCategory> }>(
      "category"
    );

    if (!tempChannelDoc) {
      console.debug(
        `[TempChannel] Channel ${newState.channel.id} is not a temporary channel`
      );
      return;
    }

    tempChannel = TempChannelDocToCached(tempChannelDoc);

    if (!tempChannel) return;

    // Cache the temp channel info
    cache.set(cacheKey, tempChannel, 300); // Cache for 5 minutes
    console.debug(
      `[TempChannel] Cached temp channel info for ${newState.channel.id}`
    );
  } else {
    console.debug(
      `[TempChannel] Cache hit for temp channel: ${newState.channel.id}`
    );
  }

  // Cache category stats to avoid repeated queries
  const categoryStatsKey = `categoryStats-${newState.guild.id}-${tempChannel.category.id}`;
  let categoryStats = cache.get<{
    totalChannels: number;
    emptyChannels: number;
  }>(categoryStatsKey);

  if (!categoryStats) {
    console.debug(
      `[TempChannel] Cache miss for category stats, querying database for category ${tempChannel.category.id}`
    );

    const [totalChannels, emptyChannels] = await Promise.all([
      TempChannel.countDocuments({
        guildId: newState.guild.id,
        category: tempChannel.category.id,
      }),
      TempChannel.countDocuments({
        guildId: newState.guild.id,
        category: tempChannel.category.id,
        userCount: 0,
      }),
    ]);

    categoryStats = { totalChannels, emptyChannels };
    cache.set(categoryStatsKey, categoryStats, 30); // Cache for 30 seconds
    console.debug(
      `[TempChannel] Category ${tempChannel.category.id} stats: ${totalChannels} total, ${emptyChannels} empty (cached)`
    );
  } else {
    console.debug(
      `[TempChannel] Cache hit for category stats: ${tempChannel.category.id} - ${categoryStats.totalChannels} total, ${categoryStats.emptyChannels} empty`
    );
  }

  // Check against the categories' max channel limit.
  if (
    tempChannel.category.maxChannels &&
    categoryStats.totalChannels >= tempChannel.category.maxChannels
  ) {
    console.debug(
      `[TempChannel] Category ${tempChannel.category.id} at max channels (${categoryStats.totalChannels}/${tempChannel.category.maxChannels}), not creating new channel`
    );
    return;
  }

  if (categoryStats.emptyChannels === 0) {
    console.debug(
      `[TempChannel] No empty channels in category ${tempChannel.category.id}, creating new channel`
    );

    // Always keep at least one empty channel available for new users.
    await createAndSaveTempChannel(
      newState.guild,
      tempChannelDoc!.category,
      tempChannel.category.parentId,
      true
    );

    // Invalidate category stats cache since we created a new channel
    cache.del(categoryStatsKey);
    console.debug(
      `[TempChannel] Created new temp channel and invalidated category stats cache for ${tempChannel.category.id}`
    );
  } else {
    console.debug(
      `[TempChannel] Category ${tempChannel.category.id} has ${categoryStats.emptyChannels} empty channel(s), no new channel needed`
    );
  }
}

// Main event handler for voice state updates.
// Handles both user joins and leaves, and updates user counts accordingly.
export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
    const userId =
      newState.member?.user.id || oldState.member?.user.id || "unknown";
    const guildId = newState.guild.id;

    console.debug(
      `[TempChannel] Voice state update for user ${userId} in guild ${guildId}`
    );
    console.debug(
      `[TempChannel] Old channel: ${
        oldState.channel?.id || "none"
      }, New channel: ${newState.channel?.id || "none"}`
    );

    // Handle user movements with debounced updates
    await updateUserCounts(
      newState.guild.id,
      oldState.channel,
      newState.channel
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
