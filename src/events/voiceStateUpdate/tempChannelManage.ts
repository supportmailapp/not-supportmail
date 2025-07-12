import { VoiceState } from "discord.js";
import { TempChannel, ITempChannelCategory } from "../../models/tempChannel.js";
import { HydratedDocument } from "mongoose";
import { createAndSaveTempChannel } from "../../utils/tempChannels.js";
// import * as Sentry from "@sentry/node";

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  console.debug("handleUserLeave called", {
    channelId: oldState.channel.id,
    guildId: oldState.guild.id,
  });

  // Check if the channel is a temporary channel
  const tempChannel = await TempChannel.findOne({
    channelId: oldState.channel.id,
    guildId: oldState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  console.debug("TempChannel fetched in handleUserLeave", {
    tempChannel,
  });

  if (!tempChannel) return;

  // Update user count
  let newUserCount = oldState.channel.members.size;
  tempChannel.userCount = newUserCount;
  await tempChannel.save();

  console.debug("User count updated in handleUserLeave", {
    newUserCount,
    tempChannel,
  });

  // If channel is now empty, check if we should delete it
  if (newUserCount <= 0) {
    // Count how many empty channels exist in this category
    const emptyChannelsInCategory = await TempChannel.countDocuments({
      guildId: oldState.guild.id,
      category: tempChannel.category._id,
      userCount: 0,
    });

    console.debug("Empty channels in category (handleUserLeave)", {
      emptyChannelsInCategory,
    });

    // If there are multiple empty channels, delete this one
    if (emptyChannelsInCategory > 1) {
      try {
        await oldState.channel.delete(
          "Temporary channel cleanup - multiple empty channels"
        );
        await tempChannel.deleteOne();
        console.debug("Deleted empty temporary channel", {
          channelName: oldState.channel.name,
        });
        console.log(
          `Deleted empty temporary channel: ${oldState.channel.name}`
        );
      } catch (error) {
        console.debug("Error deleting temporary channel", { error });
        console.error("Error deleting temporary channel:", error);
      }
    }
  }
}

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  console.debug("handleUserJoin called", {
    channelId: newState.channel.id,
    guildId: newState.guild.id,
  });

  // Check if the channel is a temporary channel
  const tempChannel = await TempChannel.findOne({
    channelId: newState.channel.id,
    guildId: newState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  console.debug("TempChannel fetched in handleUserJoin", { tempChannel });

  if (!tempChannel) return;

  // Update user count
  const newUserCount = newState.channel.members.size;
  tempChannel.userCount = newUserCount;
  await tempChannel.save();

  console.debug("User count updated in handleUserJoin", {
    newUserCount,
    tempChannel,
  });

  // Check if we need to create a new empty channel
  const emptyChannelsInCategory = await TempChannel.countDocuments({
    guildId: newState.guild.id,
    category: tempChannel.category._id,
    userCount: 0,
  });

  console.debug("Empty channels in category (handleUserJoin)", {
    emptyChannelsInCategory,
  });

  // If there are no empty channels in this category, create a new one
  if (emptyChannelsInCategory === 0) {
    await createAndSaveTempChannel(
      newState.guild,
      tempChannel.category,
      tempChannel.category.parentId,
      true
    );
    console.debug("Created new empty temp channel", {
      categoryId: tempChannel.category._id,
    });
  }
}

export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
    console.debug("voiceStateUpdate event triggered", {
      oldState,
      newState,
    });

    // Check if user left a channel (was in a channel and either left completely or moved to a different channel)
    if (
      oldState.channel &&
      (!newState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      console.debug("User left channel", {
        oldChannelId: oldState.channel.id,
      });
      await handleUserLeave(oldState);
    }

    // Check if user joined a channel (is now in a channel and either joined from nothing or moved from a different channel)
    if (
      newState.channel &&
      (!oldState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      console.debug("User joined channel", {
        newChannelId: newState.channel.id,
      });
      await handleUserJoin(newState);
    }
  } catch (error) {
    console.debug("Error in voiceStateUpdate event", { error });
    console.error("Error in voiceStateUpdate event:", error);
  }
}
