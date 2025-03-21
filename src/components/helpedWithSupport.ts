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
  console.log(
    `[DEBUG] responseHandler called with options type: ${typeof options}`
  );

  if (typeof options === "string") {
    console.log(`[DEBUG] Handling string response: "${options}"`);
    if (ctx.isStringSelectMenu()) {
      return ctx.editReply({ content: options });
    } else {
      return ctx.reply({ content: options, flags: 64 });
    }
  }

  console.log(`[DEBUG] Handling object response`);
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
    console.log(
      `[DEBUG] helpful.run called with interaction type: ${
        ctx.isButton() ? "button" : "select menu"
      }`
    );

    if (!ctx.inGuild()) {
      console.log(`[DEBUG] Interaction not in guild, exiting`);
      return;
    }

    const postId = ctx.channelId;
    console.log(`[DEBUG] Processing postId: ${postId}`);

    // Handle string select menu interaction
    if (ctx.isStringSelectMenu()) {
      console.log(
        `[DEBUG] Processing select menu with values: ${JSON.stringify(
          ctx.values
        )}`
      );
      await ctx.update({ content: "Saving...", embeds: [], components: [] });

      // Update the database with the selected users
      try {
        await SupportPost.findOneAndUpdate(
          { postId },
          { $push: { helped: { $each: ctx.values } } }
        );
        console.log(`[DEBUG] Successfully updated database with helped users`);
      } catch (error) {
        console.error(`[ERROR] Failed to update database:`, error);
      }
    }

    // Fetch post and support post data
    try {
      console.log(`[DEBUG] Fetching channel for postId: ${postId}`);
      const post = await ctx.client.channels.fetch(postId);

      if (!post || post.type !== ChannelType.PublicThread) {
        console.log(`[DEBUG] Post not found or not a public thread`);
        await responseHandler(ctx, "The post was not found.");
        return;
      }

      console.log(`[DEBUG] Fetching support post data from database`);
      const supportPost = await SupportPost.findOne({ postId });

      if (!supportPost) {
        console.log(`[DEBUG] Support post data not found in database`);
        await responseHandler(ctx, "The support post data was not found.");
        return;
      } else if (supportPost.author !== ctx.user.id) {
        console.log(
          `[DEBUG] User ${ctx.user.id} is not the author (${supportPost.author})`
        );
        await responseHandler(ctx, "You are not the author of this post.");
        return;
      } else if (!supportPost.closedAt) {
        console.log(`[DEBUG] Post is not marked as solved yet`);
        await responseHandler(ctx, "This post is currently not solved.");
        return;
      }

      // Get or fetch thread members
      console.log(`[DEBUG] Attempting to get cached thread members`);
      let cachedMembers = UsersCache.getThreadMembers(postId);

      if (!cachedMembers.length) {
        console.log(`[DEBUG] No cached members found, fetching from source`);
        cachedMembers = await UsersCache.fetchAndCacheThreadMembers(
          post,
          supportPost.author,
          ctx.client.user.id,
          ctx.isStringSelectMenu() ? ctx.values : []
        );
        console.log(`[DEBUG] Fetched ${cachedMembers.length} thread members`);
      } else {
        console.log(
          `[DEBUG] Using ${cachedMembers.length} cached thread members`
        );
      }

      // Match the cached users against the values + already in database users to result in one array with not commended users
      const allCommendedUserIds = [...supportPost.helped];
      if (ctx.isStringSelectMenu()) allCommendedUserIds.push(...ctx.values);
      console.log(`[DEBUG] All commended user IDs: ${allCommendedUserIds}`);

      const freeUsers = cachedMembers.filter(
        (member) => !allCommendedUserIds.includes(member.id)
      );
      console.log(
        `[DEBUG] Found ${freeUsers.length} users who are not commended yet`
      );

      // Reply/Edit with helpful response
      if (freeUsers.length) {
        console.log(
          `[DEBUG] Building helpful response for ${freeUsers.length} users`
        );
        await responseHandler(ctx, buildHelpfulResponse(postId, freeUsers));
        return;
      }

      // Remove the button and show "thank you"-response if there are no more members to help
      if (ctx.isButton()) {
        console.log(
          `[DEBUG] Handling button interaction with no more members to commend`
        );
        await ctx.update({
          components: [],
        });
        await ctx.followUp({
          content: NoMoreMembersResponse,
          flags: 64,
        });
        return;
      }

      console.log(
        `[DEBUG] Handling select menu with no more members to commend`
      );
      const originalMessageId =
        ctx.message.interactionMetadata?.interactedMessageId;

      if (originalMessageId) {
        console.log(`[DEBUG] Editing original message ${originalMessageId}`);
        await ctx.channel!.messages.edit(originalMessageId, {
          components: [],
        });
      }

      await ctx.editReply(NoMoreMembersResponse);
    } catch (error) {
      console.error(`[ERROR] Unhandled error in helpful.run:`, error);
      await responseHandler(
        ctx,
        "An error occurred while processing your request."
      ).catch((e) =>
        console.error(`[ERROR] Failed to send error response:`, e)
      );
    }
  },
};
