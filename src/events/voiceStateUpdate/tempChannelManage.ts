import { VoiceState } from "discord.js";
import { TempChannel, ITempChannelCategory } from "../../models/tempChannel.js";
import { HydratedDocument } from "mongoose";
import { createAndSaveTempChannel } from "../../utils/tempChannels.js";
import * as Sentry from "@sentry/node";

// Update user counts for channels after a voice state change.
// This ensures our DB reflects the current member count for temp channels.
async function updateUserCounts(
  guildId: string,
  ...voices: VoiceState["channel"][]
) {
  for (const voice of voices) {
    if (!voice || !voice?.members) continue;

    await TempChannel.updateOne(
      {
        channelId: voice.id,
        guildId: guildId,
      },
      {
        $set: { userCount: voice.members.size },
      }
    );
  }
}

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  const tempChannel = await TempChannel.findOne({
    channelId: oldState.channel.id,
    guildId: oldState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannel) return; // Only act on managed temp channels.

  const newUserCount = tempChannel.userCount;

  // If the channel is now empty, check if there are multiple empty channels in the same category.
  if (newUserCount <= 0) {
    // Find all empty channels in the category, sorted by number descending.
    const emptyChannelsInCategory = await TempChannel.find(
      {
        guildId: oldState.guild.id,
        category: tempChannel.category._id,
        userCount: 0,
      },
      null,
      { sort: { number: -1 } }
    );

    // Only delete if there is more than one empty channel.
    // This prevents deleting the last available empty channel, which is needed for new users.
    if (emptyChannelsInCategory.length > 1) {
      const toDeleteChannelId = emptyChannelsInCategory[0].channelId;
      try {
        await oldState.guild.channels.delete(
          toDeleteChannelId,
          "Temporary channel cleanup - multiple empty channels"
        );
        await TempChannel.deleteOne({
          channelId: toDeleteChannelId,
        });
        Sentry.logger.debug(
          `Deleted empty temporary channel: ${oldState.channel?.name}`
        );
      } catch (error) {
        Sentry.captureException(error);
      }
    }
  }
}

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  const tempChannel = await TempChannel.findOne({
    channelId: newState.channel.id,
    guildId: newState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannel) return; // Only act on managed temp channels.

  const tempChannelCount = await TempChannel.countDocuments({
    guildId: newState.guild.id,
    category: tempChannel.category._id,
  });

  // Check against the categories' max channel limit.
  if (
    tempChannel.category.maxChannels &&
    tempChannelCount >= tempChannel.category.maxChannels
  ) {
    // If the category has a max limit and we reached it, do not create new channels.
    return;
  }

  // Count empty channels in the category.
  // If there are none, we need to create a new empty channel for future users.
  const emptyChannelsInCategory = await TempChannel.countDocuments({
    guildId: newState.guild.id,
    category: tempChannel.category._id,
    userCount: 0,
  });

  if (emptyChannelsInCategory === 0) {
    // Always keep at least one empty channel available for new users.
    await createAndSaveTempChannel(
      newState.guild,
      tempChannel.category,
      tempChannel.category.parentId,
      true
    );
  }
}

// Main event handler for voice state updates.
// Handles both user joins and leaves, and updates user counts accordingly.
export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
    await updateUserCounts(
      newState.guild.id,
      oldState.channel,
      newState.channel
    );
    // User left a channel if they were in one and now are not, or moved to a different channel.
    if (
      oldState.channel &&
      (!newState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      await handleUserLeave(oldState);
    }

    // User joined a channel if they are now in one and either came from nothing or moved from a different channel.
    if (
      newState.channel &&
      (!oldState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      await handleUserJoin(newState);
    }
  } catch (error) {
    // Always capture unexpected errors for monitoring.
    Sentry.captureException(error);
  }
}
