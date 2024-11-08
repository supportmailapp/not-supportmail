import {
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  SlashCommandBuilder,
} from "discord.js";
import { SupportQuestion } from "../models/supportQuestion.js";
import dayjs from "dayjs";
const { supportForumId, supportPostManagerRole, supportTags } = (
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
        ephemeral: true,
      });

    const supportIssue = await SupportQuestion.findOne({
      postId: ctx.channel.id,
    });

    const hasManagerRole = ctx.member.roles.cache.has(supportPostManagerRole);

    if (!supportIssue) {
      return await ctx.reply({
        content: "This post is not a support question.",
        ephemeral: true,
      });
    } else if (
      supportIssue.userId != ctx.user.id ||
      !(
        hasManagerRole ||
        ctx.member.permissions.has("ManageGuild") ||
        ctx.member.permissions.has("Administrator")
      )
    ) {
      return await ctx.reply({
        content: `### :x: You are not authorized.\nOnly a staff member or voluntary helper can mark this post for review by a dev.`,
        ephemeral: true,
      });
    }

    await ctx.channel.setAppliedTags([
      supportTags.reviewNeeded,
      supportTags[supportIssue._type],
    ]);

    await supportIssue.updateOne({
      "flags.noAutoClose": true,
      state: "reviewNeeded",
    });

    await ctx.reply({
      embeds: [
        {
          author: {
            name: ctx.user.username,
            icon_url: ctx.user.avatarURL(),
          },
          description:
            "## ✅ Post Marked for Review\n_ _\n" +
            ">>> This post has been marked for review by a developer. Please be patient while we review your issue.\n" +
            "Make sure to keep an eye on this post for any updates!",
          color: Colors.Green,
          timestamp: dayjs().toISOString(),
        },
      ],
    });
  },
};
