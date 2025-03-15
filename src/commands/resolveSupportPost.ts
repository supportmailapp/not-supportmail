import dayjs from "dayjs";
import {
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  type GuildMember,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import config from "../config.js";
import { buildHelpfulResponse, canUpdateSupportPost } from "../utils/main.js";
import { DBUser } from "../models/user.js";

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
      !ctx.channel || // TS BS
      ctx.channel.type !== ChannelType.PublicThread ||
      ctx.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM
    )
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        flags: 64,
      });

    if (!ctx.inCachedGuild()) await ctx.guild!.fetch();

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

    if (!canUpdateSupportPost(ctx.member as GuildMember, supportPost.author)) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be resolved by the author or a staff member.`,
        flags: 64,
      });
    }

    await ctx.channel.edit({
      appliedTags: [config.tags.solved],
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });

    await supportPost.updateOne({
      closedAt: dayjs().toDate(),
    });

    await ctx.deferReply({ flags: 64 });

    await ctx.channel.send({
      content:
        "### ✅ This post has been resolved!\n-# It will be automatically archived in 24 hours.",
      embeds: [
        {
          author: {
            name: ctx.user.username,
            icon_url: ctx.user.displayAvatarURL() ?? ctx.user.defaultAvatarURL,
          },
          footer: ctx.options.getString("reason")
            ? {
                text: "Reason: " + ctx.options.getString("reason", true),
              }
            : undefined,
          color: Colors.Aqua,
        },
      ],
    });

    const users = await DBUser.find(
      {
        id: { $in: supportPost.users },
      },
      null,
      {
        limit: 25, // just in case
      }
    );

    await ctx.editReply(buildHelpfulResponse(users));
  },
};
