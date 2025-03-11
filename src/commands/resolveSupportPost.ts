import dayjs from "dayjs";
import {
  ChannelType,
  ChatInputCommandInteraction,
  type GuildMemberRoleManager,
  type PermissionsBitField,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import config from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("resolve")
    .setDescription("Resolve a support question.")
    .setContexts(0)
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
      ctx.channel.type !== ChannelType.PublicThread ||
      ctx.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM
    )
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        flags: 64,
      });

    if (!ctx.inCachedGuild()) await ctx.guild.fetch();

    const supportPost = await SupportPost.findOne({
      postId: ctx.channel.id,
    });

    if (!supportPost) {
      return await ctx.reply({
        content: "This post is not a support question.",
        flags: 64,
      });
    } else if (supportPost.closedAt) {
      return await ctx.reply({
        content: "This post has already been resolved.",
        flags: 64,
      });
    }

    const memberPermissions = ctx.member
      .permissions as Readonly<PermissionsBitField>;
    const canReopenPostRolewise =
      (ctx.member.roles as GuildMemberRoleManager).cache.hasAny(
        process.env.ROLE_THREAD_MANAGER,
        process.env.ROLE_DEVELOPER
      ) || ctx.user.id == supportPost.author;
    const canReopenPostPermissionwise =
      memberPermissions.has("ManageGuild") ||
      memberPermissions.has("Administrator");

    if (!canReopenPostRolewise && !canReopenPostPermissionwise) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be resolved by the author, a staff member or voluntary helper.`,
        flags: 64,
      });
    }

    const reason = ctx.options.getString("reason") || null;

    await ctx.channel.edit({
      appliedTags: [config.tags.solved],
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
