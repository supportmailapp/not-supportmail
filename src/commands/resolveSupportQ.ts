import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { SupportQuestion } from "../models/supportQuestion.js";
const { supportForumId, supportPostManagerRole, supportTags } = (
  await import("../../config.json", { with: { type: "json" } })
).default;

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
      ctx.channel.parentId !== supportForumId ||
      ctx.channel.parent?.type !== ChannelType.GuildForum
    )
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        ephemeral: true,
      });

    const supportIssue = await SupportQuestion.findOne({
      postId: ctx.channel.id,
    });

    const memberRoles = Array.isArray(ctx.member.roles)
      ? ctx.member.roles
      : ctx.member.roles.cache.map((r) => r.id);

    if (!supportIssue) {
      return await ctx.reply({
        content: "This post is not a support question.",
        ephemeral: true,
      });
    } else if (
      supportIssue.userId != ctx.user.id ||
      !(
        memberRoles.includes(supportPostManagerRole) ||
        ctx.member.permissions.has("ManageGuild") ||
        ctx.member.permissions.has("Administrator")
      )
    ) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be resolved by the author or a staff member.`,
        allowedMentions: { parse: [] },
        ephemeral: true,
      });
    }

    const reason = ctx.options.getString("reason") || null;

    await ctx.channel.setAppliedTags([
      supportTags.resolved,
      supportTags[supportIssue._type],
    ]);

    await supportIssue.updateOne({
      resolved: true,
      state: "resolved",
    });

    await ctx.reply({
      content:
        `### ✅ This post has been resolved!\n-# It will be automatically archived in 24 hours.` +
        (reason ? `\n\n**Reason:** ${reason}` : ""),
      allowedMentions: { parse: [] },
    });
  },
};
