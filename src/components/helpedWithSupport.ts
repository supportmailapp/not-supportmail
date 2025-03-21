import {
  ButtonInteraction,
  ChannelType,
  type StringSelectMenuInteraction,
} from "discord.js";
import * as UsersCache from "../caches/helpfulUsers.js";
import { SupportPost } from "../models/supportPost.js";
import { buildHelpfulResponse } from "../utils/main.js";

const NoMoreMembersResponse =
  "No more members to award. Thank you for commending fellow members!";

export default {
  prefix: "helpful",

  async run(ctx: StringSelectMenuInteraction | ButtonInteraction) {
    if (!ctx.inGuild()) return;

    const postId = ctx.channelId;

    // Handle string select menu interaction
    if (ctx.isStringSelectMenu()) {
      await ctx.update({ content: "Saving...", embeds: [], components: [] });

      // Update the database with the selected users
      await SupportPost.findOneAndUpdate(
        { postId },
        { $push: { helped: { $each: ctx.values } } }
      );
    }

    const responseHandler = ctx.isStringSelectMenu()
      ? ctx.editReply
      : ctx.reply;

    // Fetch post and support post data
    const post = await ctx.client.channels.fetch(postId);
    if (!post || post.type !== ChannelType.PublicThread) {
      await responseHandler("The post was not found.");
      return;
    }

    const supportPost = await SupportPost.findOne({ postId });
    if (!supportPost) {
      await responseHandler("The support post data was not found.");
      return;
    } else if (supportPost.author !== ctx.user.id) {
      await responseHandler("You are not the author of this post.");
      return;
    } else if (!supportPost.closedAt) {
      await responseHandler("This post is currently not solved.");
      return;
    }

    // Get or fetch thread members
    let members = UsersCache.getThreadMembers(postId);
    if (!members.length) {
      members = await UsersCache.fetchAndCacheThreadMembers(
        post,
        supportPost.author,
        ctx.client.user.id,
        ctx.isStringSelectMenu() ? ctx.values : []
      );
    }

    // Reply/Edit with helpful response
    if (members.length) {
      await responseHandler(buildHelpfulResponse(postId));
      return;
    }

    // Remove the button and show "thank you"-response if there are no more members to help
    if (ctx.isButton()) {
      await ctx.update({
        components: [],
      });
      await ctx.followUp({
        content: NoMoreMembersResponse,
        flags: 64,
      });
      return;
    }

    const originalMessageId =
      ctx.message.interactionMetadata?.interactedMessageId;
    if (originalMessageId) {
      await ctx.channel!.messages.edit(originalMessageId, {
        components: [],
      });
    }
    await ctx.editReply(NoMoreMembersResponse);
  },
};
