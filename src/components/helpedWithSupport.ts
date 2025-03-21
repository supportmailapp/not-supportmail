import {
  ButtonInteraction,
  ChannelType,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type StringSelectMenuInteraction,
} from "discord.js";
import * as UsersCache from "../caches/helpfulUsers.js";
import { SupportPost } from "../models/supportPost.js";
import { buildHelpfulResponse } from "../utils/main.js";

const NoMoreMembersResponse =
  "No more members left. Thank you for commending your fellow members!";

function responseHandler(
  ctx: StringSelectMenuInteraction | ButtonInteraction,
  options: string | InteractionEditReplyOptions | InteractionReplyOptions
): Promise<any> {
  if (typeof options === "string") {
    if (ctx.isStringSelectMenu()) {
      return ctx.editReply({ content: options });
    } else {
      return ctx.reply({ content: options, flags: 64 });
    }
  }

  if (ctx.isStringSelectMenu()) {
    return ctx.editReply({
      content: "",
      ...options,
    } as InteractionEditReplyOptions);
  } else {
    return ctx.reply({ ...options, flags: 64 } as InteractionReplyOptions);
  }
}

export default {
  prefix: "helpful",

  async run(ctx: StringSelectMenuInteraction | ButtonInteraction) {
    if (!ctx.inGuild()) {
      return;
    }

    const postId = ctx.channelId;

    // Handle string select menu interaction
    if (ctx.isStringSelectMenu()) {
      await ctx.update({ content: "Saving...", embeds: [], components: [] });

      // Update the database with the selected users
      try {
        await SupportPost.findOneAndUpdate(
          { postId },
          { $push: { helped: { $each: ctx.values } } }
        );
      } catch {
        // Error handled silently
      }
    }

    // Fetch post and support post data
    try {
      const post = await ctx.client.channels.fetch(postId);

      if (!post || post.type !== ChannelType.PublicThread) {
        await responseHandler(ctx, "The post was not found.");
        return;
      }

      const supportPost = await SupportPost.findOne({ postId });

      if (!supportPost) {
        await responseHandler(ctx, "The support post data was not found.");
        return;
      } else if (supportPost.author !== ctx.user.id) {
        await responseHandler(ctx, "You are not the author of this post.");
        return;
      } else if (!supportPost.closedAt) {
        await responseHandler(ctx, "This post is currently not solved.");
        return;
      }

      // Get or fetch thread members
      let cachedMembers = UsersCache.getThreadMembers(postId);

      if (!cachedMembers.length) {
        cachedMembers = await UsersCache.fetchAndCacheThreadMembers(
          post,
          supportPost.author,
          ctx.client.user.id,
          ctx.isStringSelectMenu() ? ctx.values : []
        );
      }

      // Match the cached users against the values + already in database users to result in one array with not commended users
      const allCommendedUserIds = [...supportPost.helped];
      if (ctx.isStringSelectMenu()) allCommendedUserIds.push(...ctx.values);

      const freeUsers = cachedMembers.filter(
        (member) => !allCommendedUserIds.includes(member.id)
      );

      // Reply/Edit with helpful response
      if (freeUsers.length) {
        await responseHandler(ctx, buildHelpfulResponse(postId, freeUsers));
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
    } catch (error) {
      await responseHandler(
        ctx,
        "An error occurred while processing your request."
      ).catch(() => {
        // Error handled silently
      });
    }
  },
};
