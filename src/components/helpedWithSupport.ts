import { ChannelType, type StringSelectMenuInteraction } from "discord.js";
import * as UsersCache from "../caches/helpfulUsers.js";
import { SupportPost } from "../models/supportPost.js";
import { buildHelpfulResponse, parseCustomId } from "../utils/main.js";

export default {
  prefix: "helpful",

  async run(ctx: StringSelectMenuInteraction) {
    await ctx.update({ content: "Saving...", embeds: [], components: [] });

    const { firstParam: postId } = parseCustomId(ctx.customId) as {
      firstParam: string;
    };

    await SupportPost.findOneAndUpdate(
      { postId: postId },
      { $push: { helped: { $each: ctx.values } } }
    );

    const post = await ctx.client.channels.fetch(postId);
    if (!post || post.type !== ChannelType.PublicThread) {
      await ctx.editReply("The post was not found.");
      return;
    }

    const allMembers = await post.members.fetch({
      withMember: true,
      cache: true,
    });
    // Filter out the members that have already been helped + the bot + the author
    const members = allMembers.filter((member) => {
      return (
        !ctx.values.includes(member.id) &&
        member.id !== ctx.client.user.id &&
        member.id !== post.ownerId
      );
    });

    if (members.size > 0) {
      const partialMembers = members.map(({ id, guildMember: member }) => ({
        id: id,
        displayName: member.displayName ?? member.user.displayName,
      }));
      UsersCache.setThreadMembers(postId, partialMembers);

      await ctx.editReply(buildHelpfulResponse(postId));
    } else {
      await ctx.editReply(
        "<:gigapepo:1350161277347037305> No more users to show. Thank you!"
      );
    }
  },
};
