import {
  ChannelType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import { canUpdateSupportPost } from "../utils/main.js";
import * as SolveSubcommand from "./utils/supportQuestions/solve.js";
import * as UnsolveSubcommand from "./utils/supportQuestions/unsolve.js";
import * as DevSubcommand from "./utils/supportQuestions/dev.js";
import * as PrioritySubcommand from "./utils/supportQuestions/priority.js";
import { EphemeralComponentsV2Flags } from "../utils/enums.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Manage support questions")
    .setContexts(0)
    .addSubcommand(SolveSubcommand.data)
    .addSubcommand(UnsolveSubcommand.data)
    .addSubcommand(DevSubcommand.data)
    .addSubcommand(PrioritySubcommand.data),

  async run(ctx: ChatInputCommandInteraction) {
    if (
      !ctx.channel || // TS BS
      ctx.channel.type !== ChannelType.PublicThread ||
      ctx.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM
    ) {
      return await ctx.reply({
        content: "This is the wrong channel my friend.",
        flags: 64,
      });
    }

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

    const subcommand = ctx.options.getSubcommand();

    // Check if the user can update the support post
    const isAllowedToUpdate = !canUpdateSupportPost(
      ctx.member as GuildMember,
      subcommand === "solve" || subcommand === "unsolve"
        ? supportPost.author
        : null
    );

    if (isAllowedToUpdate) {
      const reason =
        subcommand === "solve" || subcommand === "unsolve"
          ? "Only the author or a staff member can do this."
          : "Only a staff member can do this.";

      await ctx.reply({
        flags: EphemeralComponentsV2Flags,
        components: [
          new TextDisplayBuilder().setContent(
            "### :x: You are not authorized to mark this post for review by a developer.\n" +
              `-# ${reason}`
          ),
        ],
      });
      return;
    }

    switch (subcommand) {
      case "solve":
        await SolveSubcommand.handler(ctx, ctx.channel, supportPost);
        break;
      case "unsolve":
        await UnsolveSubcommand.handler(ctx, ctx.channel, supportPost);
        break;
      case "dev":
        await DevSubcommand.handler(ctx, ctx.channel, supportPost);
        break;
      case "priority":
        await PrioritySubcommand.handler(ctx, ctx.channel, supportPost);
        break;
      default:
        await ctx.reply({
          content: "Unknown subcommand.",
          flags: 64,
        });
        break;
    }
    return;
  },
};
