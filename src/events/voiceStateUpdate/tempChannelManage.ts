import { VoiceState } from "discord.js";
import { TempChannel, ITempChannelCategory } from "../../models/tempChannel.js"; // Adjust path as needed
import { HydratedDocument } from "mongoose";
import { createAndSaveTempChannel } from "../../utils/tempChannels.js";

async function handleUserLeave(oldState: VoiceState) {
  if (!oldState.channel || !oldState.guild) return;

  // Check if the channel is a temporary channel
  const tempChannel = await TempChannel.findOne({
    channelId: oldState.channel.id,
    guildId: oldState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannel) return;

  // Update user count
  /**
   * The new user count of the channel.
   *
   * Although, it's taken from the oldState, it's a getter of the client's cache
   * and returns the already updated count.
   * {@see https://discord.com/channels/222078108977594368/824411059443204127/1393668832672878623}
   */
  let newUserCount = oldState.channel.members.size;
  tempChannel.userCount = newUserCount;
  await tempChannel.save();

  // If channel is now empty, check if we should delete it
  if (newUserCount <= 0) {
    // Count how many empty channels exist in this category
    const emptyChannelsInCategory = await TempChannel.countDocuments({
      guildId: oldState.guild.id,
      category: tempChannel.category._id,
      userCount: 0,
    });

    // If there are multiple empty channels, delete this one
    if (emptyChannelsInCategory > 1) {
      try {
        await oldState.channel.delete(
          "Temporary channel cleanup - multiple empty channels"
        );
        await tempChannel.deleteOne();
        console.log(
          `Deleted empty temporary channel: ${oldState.channel.name}`
        );
      } catch (error) {
        console.error("Error deleting temporary channel:", error);
      }
    }
  }
}

async function handleUserJoin(newState: VoiceState) {
  if (!newState.channel || !newState.guild) return;

  // Check if the channel is a temporary channel
  const tempChannel = await TempChannel.findOne({
    channelId: newState.channel.id,
    guildId: newState.guild.id,
  }).populate<{ category: HydratedDocument<ITempChannelCategory> }>("category");

  if (!tempChannel) return;

  // Update user count
  const newUserCount = newState.channel.members.size;
  tempChannel.userCount = newUserCount;
  await tempChannel.save();

  // Check if we need to create a new empty channel
  const emptyChannelsInCategory = await TempChannel.countDocuments({
    guildId: newState.guild.id,
    category: tempChannel.category._id,
    userCount: 0,
  });

  // If there are no empty channels in this category, create a new one
  if (emptyChannelsInCategory === 0) {
    await createAndSaveTempChannel(
      newState.guild,
      tempChannel.category,
      tempChannel.category.parentId,
      true
    );
  }
}

export default async function (oldState: VoiceState, newState: VoiceState) {
  try {
    // Check if user left a channel (was in a channel and either left completely or moved to a different channel)
    if (
      oldState.channel &&
      (!newState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      await handleUserLeave(oldState);
    }

    // Check if user joined a channel (is now in a channel and either joined from nothing or moved from a different channel)
    if (
      newState.channel &&
      (!oldState.channel || oldState.channel.id !== newState.channel.id)
    ) {
      await handleUserJoin(newState);
    }
  } catch (error) {
    console.error("Error in voiceStateUpdate event:", error);
  }
}
