import dayjs from "dayjs";
import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import config from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("resolve")
    .setDescription("Resolve a support question.")
    .addStringOption((op) =>
      op
        .setName("reason")
        .setDescription(
          "The reason for resolving the question | Is publicly displayed!"
        )
        .setMaxLength(128)
        .setRequired(false)
    ),
  async run(ctx: ChatInputCommandInteraction) {
    if (
      ctx.channel.isDMBased() ||
      !ctx.inCachedGuild() ||
      !(
        ctx.channel.type === ChannelType.PublicThread ||
        ctx.channel.type === ChannelType.PrivateThread
      ) ||
      ctx.channel.parentId !== config.supportForumId ||
      ctx.channel.parent?.type !== ChannelType.GuildForum
    )
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        flags: 64,
      });

    const supportPost = await SupportPost.findOne({
      postId: ctx.channel.id,
    });

    const hasManagerRole = ctx.member.roles.cache.has(config.threadManagerRole);

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
      !hasManagerRole &&
      !ctx.member.permissions.has("ManageGuild") &&
      !ctx.member.permissions.has("Administrator")
    ) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be resolved by the author, a staff member or voluntary helper.`,
        flags: 64,
      });
    }

    const reason = ctx.options.getString("reason") || null;

    await ctx.channel.edit({
      appliedTags: [config.supportTags.resolved],
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });

    await supportPost.updateOne({
      closedAt: dayjs().toDate(),
    });

    await ctx.reply({
      content:
        "### ✅ This post has been resolved!\n-# It will be automatically archived in 24 hours." +
        (reason ? `\n\n**Reason:** ${reason}` : ""),
    });
  },
};
