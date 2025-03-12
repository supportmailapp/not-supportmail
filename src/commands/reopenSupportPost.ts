import dayjs from "dayjs";
import {
  ChannelType,
  ChatInputCommandInteraction,
  type GuildMember,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import config from "../config.js";
import { canUpdateSupportPost } from "../utils/main.js";

export default {
  data: new SlashCommandBuilder()
    .setName("reopen")
    .setContexts(0)
    .setDescription("Reopen a resolved support question.")
    .addStringOption((op) =>
      op
        .setName("reason")
        .setDescription(
          "The reason for reopening the question | Is publicly displayed!"
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
    } else if (!supportPost.closedAt) {
      return await ctx.reply({
        content: "This post has not been resolved yet.",
        flags: 64,
      });
    }

    if (!canUpdateSupportPost(ctx.member as GuildMember, supportPost.author)) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be resolved by the author or a staff member.`,
        flags: 64,
      });
    }

    const tags = ctx.channel.appliedTags;
    await ctx.channel.edit({
      appliedTags: [
        ...tags.filter((tid) => !Object.values(config.tags).includes(tid)),
        config.tags.unanswered,
      ],
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    });

    await supportPost.updateOne({
      closedAt: null,
      remindedAt: null,
      lastActivity: dayjs().toDate(),
      $unset: {
        ignoreFlags: "",
        flags: "",
      },
    });

    await ctx.reply({
      content: "### ✅ Post has been reopened!",
      embeds: ctx.options.getString("reason")
        ? [
            {
              author: {
                name: "Reason",
              },
              description: ctx.options.getString("reason"),
              color: 0x2b2d31,
            },
          ]
        : undefined,
    });
  },
};
