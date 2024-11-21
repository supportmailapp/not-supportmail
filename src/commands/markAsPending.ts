import {
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  SlashCommandBuilder,
} from "discord.js";
import { SupportQuestion } from "../models/supportQuestion.js";
import dayjs from "dayjs";
const { supportForumId, devRole, supportTags } = (
  await import("../../config.json", { with: { type: "json" } })
).default;

export default {
  data: new SlashCommandBuilder()
    .setName("mark-as-pending")
    .setDescription("Mark a post as pending (Currently under review)"),

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

    if (!supportIssue) {
      return await ctx.reply({
        content: "This post is not a support question.",
        ephemeral: true,
      });
    } else if (!ctx.member.roles.cache.has(devRole)) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nOnly a dev can mark this post as pending.`,
        ephemeral: true,
      });
    }

    await ctx.channel.setAppliedTags([
      supportTags.pending,
      supportTags[supportIssue._type],
    ]);

    await supportIssue.updateOne({
      "flags.noAutoClose": true,
      state: "pending",
    });

    await ctx.reply({
      embeds: [
        {
          description: `Post Marked as **Pending** by <@${ctx.user.id}>.`,
          color: Colors.Yellow,
          timestamp: dayjs().toISOString(),
        },
      ],
    });
  },
};
