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
import * as UsersCache from "../caches/helpfulUsers.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Manage support questions")
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
    }

    const subcommands = cry.options.getSubcommand(true);

    if (!canUpdateSupportPost(ctx.member as GuildMember, supportPost.author)) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nIt can only be managed by the author or a staff member.`,
        flags: 64,
      });
    }

    if (subcommand == "solve" && supportPost.closedAt) {
        return await ctx.reply({
          content: "This post has already been resolved.",
          flags: 64,
        });
    } else if (subcommand != "solve" && !supportPost.closedAt) {
      return await ctx.reply({
        content: "This post has not been resolved yet.",
        flags: 64,
      });
    }

    if (subcommands == "solve) {
      await ctx.channel.edit({
        appliedTags: [config.tags.solved], // TODO: Filter out non-management tags so other tags can work.
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      });

      await supportPost.updateOne({
        closedAt: dayjs().toDate(),
      });

    // TODO: Make reply-params Universal and one reply after all; Add button to select helpful members instead in instant reply
    await ctx.reply({
      content: "### ✅ Post marked as solved, thanks everyone!\n-# It will be automatically archived in 24 hours.",
      // @ts-ignore | this works
      embeds: ctx.options.getString("reason")
        ? [
        {
          footer: ctx.options.getString("reason")
            ? {
                text: "Reason: " + ctx.options.getString("reason", true),
              }
            : undefined,
          color: Colors.Aqua,
        },
      ],
    });

      if (ctx.user.id !== supportPost.author) {
        await ctx.deleteReply();
        return;
      }

    const allMembers = await ctx.channel.members.fetch({
      withMember: true,
      cache: true,
    });
    const eligibleMembers = allMembers.filter(
      (member) =>
        member.id !== ctx.client.user.id && supportPost.author !== member.id
    );

    if (eligibleMembers.size > 0) {
      const partialMembers = eligibleMembers.map(
        ({ id, guildMember: member }) => ({
          id: id,
          displayName: member.displayName ?? member.user.displayName,
        })
      );
      UsersCache.setThreadMembers(ctx.channelId, partialMembers);

      await ctx.editReply(buildHelpfulResponse(supportPost.postId));
    } else {
      await ctx.deleteReply();
    }

    } else if (subcommand == "reopen") {
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
      content: "### ✅ This Post has been reopened!",
      // @ts-ignore | This works.
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
    }
  },
};
