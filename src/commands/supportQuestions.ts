import {
  ChannelType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { canUpdateSupportPost } from "../utils/main.js";
import { EphemeralComponentsV2Flags } from "../utils/enums.js";
import config from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("question")
    .setDescription("Manage support questions")
    .setContexts(0)
    .addSubcommand((sub) =>
      sub.setName("solve").setDescription("Mark the post as solved")
    )
    .addSubcommand((sub) =>
      sub.setName("unsolve").setDescription("Mark the post as unsolved")
    )
    .addSubcommand((sub) =>
      sub
        .setName("dev")
        .setDescription("Mark the post for review by a developer")
    ),

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

    const subcommand = ctx.options.getSubcommand();

    // Check if the user can update the support post
    const threadOwner = ctx.channel.ownerId;
    const isAllowedToUpdate = !canUpdateSupportPost(
      ctx.member as GuildMember,
      subcommand === "solve" || subcommand === "unsolve" ? threadOwner : null
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

    await ctx.deferReply({ flags: 64 });

    switch (subcommand) {
      case "solve":
        const currentTags = ctx.channel.appliedTags || [];
        if (currentTags.includes(config.tags.solved)) {
          return ctx.editReply("This post is already marked as solved.");
        }
        const newTags = currentTags.concat([config.tags.solved]);
        await ctx.channel.setAppliedTags(newTags);
        break;
      case "unsolve":
        const existingTags = ctx.channel.appliedTags || [];
        if (!existingTags.includes(config.tags.solved)) {
          return ctx.editReply("This post is not marked as solved.");
        }
        const updatedTags = existingTags.filter(
          (tag) => tag !== config.tags.solved
        );
        await ctx.channel.setAppliedTags(updatedTags);
        break;
      case "dev":
        const devTags = ctx.channel.appliedTags || [];
        if (devTags.includes(config.tags.dev)) {
          return ctx.editReply(
            "This post is already marked for developer review."
          );
        } else if (devTags.includes(config.tags.solved)) {
          return ctx.editReply(
            "A solved post cannot be marked for developer review. Unsolve it first."
          );
        }
        const newDevTags = devTags.concat([config.tags.dev]);
        await ctx.channel.setAppliedTags(newDevTags);
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
