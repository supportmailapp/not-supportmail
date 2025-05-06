import dayjs from "dayjs";
import {
  ActionRowBuilder,
  APIEmbed,
  ButtonBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  type GuildMember,
  InteractionEditReplyOptions,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import * as UsersCache from "../caches/helpfulUsers.js";
import config from "../config.js";
import { SupportPost } from "../models/supportPost.js";
import { canUpdateSupportPost } from "../utils/main.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Manage support questions")
    .setContexts(0)
    .addSubcommand((sub) =>
      sub
        .setName("solve")
        .setDescription("Mark a support question as solved")
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Reason for marking as solved")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reopen")
        .setDescription("Reopen a support question")
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Reason for reopening")
            .setRequired(false)
        )
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

    if (!canUpdateSupportPost(ctx.member as GuildMember, supportPost.author)) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\n> This post can only be managed by the author or a staff member.`,
        flags: 64,
      });
    }
    const subcommand = ctx.options.getSubcommand();

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

    await ctx.deferReply();

    // Typescript is being a pain, so we have to do this
    let replyOptions: InteractionEditReplyOptions & { embeds?: APIEmbed[] } =
      {};
    if (subcommand == "solve") {
      const tags = ctx.channel.appliedTags;
      await ctx.channel.edit({
        appliedTags: [
          ...tags.filter((tid) => !Object.values(config.tags).includes(tid)),
          config.tags.solved,
        ],
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      });

      await supportPost.updateOne({
        closedAt: dayjs().toDate(),
      });

      replyOptions = {
        embeds: [
          {
            description:
              "### ✅ This Post has been marked as solved, thanks everyone!",
            color: 0x2b2d31,
            footer: {
              text: "You can commend the most helpful users below.",
            },
          },
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().setComponents(
            new ButtonBuilder({
              customId: "helpful",
              label: "Select users",
              style: 1,
              emoji: {
                name: "🙌",
              },
            })
          ),
        ],
      };

      await UsersCache.fetchAndCacheThreadMembers(
        ctx.channel,
        supportPost.author,
        ctx.client.user.id,
        supportPost.helped
      );
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
        helped: [],
        $unset: {
          ignoreFlags: "",
          flags: "",
        },
      });

      replyOptions = {
        embeds: [
          {
            description: "### 🔄 This Post has been reopened.",
            color: 0x2b2d31,
          },
        ],
      };
    }

    const reason = ctx.options.getString("reason");
    if (reason) {
      replyOptions.embeds![0].fields = [
        {
          name: "__Reason__",
          value: reason,
        },
      ];
    }

    if (ctx.user.id !== supportPost.author) {
      replyOptions.content = `-# <@${supportPost.author}>`;
      replyOptions.allowedMentions = {
        parse: ["users"],
      };
    }

    await ctx.editReply(replyOptions);
  },
};
