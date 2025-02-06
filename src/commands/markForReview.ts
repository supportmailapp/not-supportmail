import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
const { devRoleId, supportForumId, threadManagerRole, supportTags } = (
  await import("../../config.json", { with: { type: "json" } })
).default;

export default {
  data: new SlashCommandBuilder()
    .setName("mark-for-review")
    .setDescription("Mark a post for review by a developer."),

  async run(ctx: ChatInputCommandInteraction) {
    if (
      ctx.channel.isDMBased() ||
      !ctx.inCachedGuild() ||
      !(
        ctx.channel.type === ChannelType.PublicThread ||
        ctx.channel.type === ChannelType.PrivateThread
      ) ||
      ctx.channel.parentId !== supportForumId ||
      ctx.channel.parent?.type !== ChannelType.GuildForum
    )
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        flags: 64,
      });

    const supportPost = await SupportPost.findOne({
      postId: ctx.channel.id,
    });

    const canMark = ctx.member.roles.cache.some(
      (r) => r.id === devRoleId || r.id === threadManagerRole
    );

    if (!supportPost) {
      return await ctx.reply({
        content: "This post is not a support question.",
        flags: 64,
      });
    }

    if (supportPost.closedAt) {
      return await ctx.reply({
        content: "This post has already been resolved.",
        flags: 64,
      });
    }

    if (
      supportPost.author != ctx.user.id &&
      !canMark &&
      !ctx.member.permissions.has("ManageGuild") &&
      !ctx.member.permissions.has("Administrator")
    ) {
      return await ctx.reply({
        content:
          "### :x: You are not authorized.\nIt can only be resolved by the author, a staff member or voluntary helper.",
        flags: 64,
      });
    }

    await supportPost.updateOne({
      remindedAt: null,
      ignoreFlags: {
        reminder: true,
        close: true,
      },
      flags: {
        noArchive: true,
      },
    });

    await ctx.channel.edit({
      appliedTags: [supportTags.reviewNeeded],
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    });

    await ctx.reply({
      content:
        "### ✅ Post Marked for Review\n" +
        ">>> This post has been marked for review by a developer. Please be patient while we review your issue.\n" +
        "Make sure to keep an eye on this post for any updates!",
    });
  },
};
