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
  for (const voice of voices) {
    if (!voice?.members) continue;

    const cacheKey = `${guildId}-${voice.id}`;

    // Clear any existing pending update for this channel
    if (pendingUpdates.has(cacheKey)) {
      clearTimeout(pendingUpdates.get(cacheKey)!);
    }

    // Set a new debounced update
    pendingUpdates.set(
      cacheKey,
      setTimeout(async () => {
        try {
          // Get fresh member count at time of execution
          if (!voice.members) return;

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

          // Clean up
          pendingUpdates.delete(cacheKey);
        } catch (error) {
          Sentry.captureException(error);
          pendingUpdates.delete(cacheKey);
        }
      }, userCountUpdateDelay * 1000)
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
    return cachedCount;
  }

  // If not cached, get from database
  const tempChannel = await TempChannel.findOne({
    channelId,
    guildId,
  });

  if (tempChannel) {
    const count = tempChannel.userCount;
    cache.set(cacheKey, count, 3);
    return count;
  }

  // Last resort: get from Discord API if channel provided
  if (fallbackChannel?.members) {
    return fallbackChannel.members.size;
  }

  return 0;
}

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  // Check cache first to avoid unnecessary DB queries
  const cacheKey = `tempChannel-${oldState.guild.id}-${oldState.channel.id}`;
  let tempChannel = cache.get<CachedTempChannel>(cacheKey);

  if (!tempChannel) {
    const tempChannelDoc = await TempChannel.findOne({
      channelId: oldState.channel.id,
      guildId: oldState.guild.id,
    }).populate<{ category: HydratedDocument<ITempChannelCategory> }>(
      "category"
    );

    if (!tempChannelDoc) return;

    tempChannel = TempChannelDocToCached(tempChannelDoc);
    // Cache the temp channel info
    cache.set(cacheKey, tempChannel, 300); // Cache for 5 minutes
  }

  // Get current user count (with potential delay/debouncing)
  const newUserCount = await getUserCount(
    oldState.channel.id,
    oldState.guild.id,
    oldState.channel
  );

  // If the channel is now empty, check if there are multiple empty channels in the same category.
  if (newUserCount <= 0) {
    // Add small delay to prevent race conditions with rapid joins/leaves
    setTimeout(async () => {
      try {
        // Double-check the count after delay
        const finalUserCount = await getUserCount(
          oldState.channel!.id,
          oldState.guild!.id,
          oldState.channel
        );

        if (finalUserCount > 0) return; // Someone joined in the meantime

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

        // Only delete if there is more than one empty channel.
        if (emptyChannelsInCategory.length > 1) {
          const toDeleteChannelId = emptyChannelsInCategory[0].channelId;
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

            Sentry.logger.debug(
              `Deleted empty temporary channel: ${oldState.channel?.name}`
            );
          } catch (error) {
            Sentry.captureException(error);
          }
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    }, 2000); // 2 second delay to prevent race conditions
  }
}

// TODO: Test caching logic with multiple users joining/leaving rapidly

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  // Check cache first
  const cacheKey = `tempChannel-${newState.guild.id}-${newState.channel.id}`;
  let tempChannel = cache.get<CachedTempChannel>(cacheKey);
  let tempChannelDoc:
    | (HydratedDocument<Omit<ITempChannel, "category">> & {
        category: HydratedDocument<ITempChannelCategory>;
      })
    | null;

  if (!tempChannel) {
    tempChannelDoc = await TempChannel.findOne({
      channelId: newState.channel.id,
      guildId: newState.guild.id,
    }).populate<{ category: HydratedDocument<ITempChannelCategory> }>(
      "category"
    );

    if (!tempChannelDoc) return;

    tempChannel = TempChannelDocToCached(tempChannelDoc);

    if (!tempChannel) return;

    // Cache the temp channel info
    cache.set(cacheKey, tempChannel, 300); // Cache for 5 minutes
  }

  // Cache category stats to avoid repeated queries
  const categoryStatsKey = `categoryStats-${newState.guild.id}-${tempChannel.category.id}`;
  let categoryStats = cache.get<{
    totalChannels: number;
    emptyChannels: number;
  }>(categoryStatsKey);

  if (!categoryStats) {
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
  }

  // Check against the categories' max channel limit.
  if (
    tempChannel.category.maxChannels &&
    categoryStats.totalChannels >= tempChannel.category.maxChannels
  ) {
    return;
  }

  if (categoryStats.emptyChannels === 0) {
    // Always keep at least one empty channel available for new users.
    await createAndSaveTempChannel(
      newState.guild,
      tempChannelDoc!.category,
      tempChannel.category.parentId,
      true
    );

    // Invalidate category stats cache since we created a new channel
    cache.del(categoryStatsKey);
  }
}

// Main event handler for voice state updates.
// Handles both user joins and leaves, and updates user counts accordingly.
export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
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
      await handleUserLeave(oldState);
    }

    // User joined a channel
    if (
      newState.channel &&
      (!oldState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      await handleUserJoin(newState);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}
