import {
  ChannelType,
  Colors,
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThreadAutoArchiveDuration,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import config from "../config.js";
import { ComponentsV2Flags, EphemeralV2Flags } from "../utils/enums.js";
import { canUpdateSupportPost } from "../utils/main.js";

// Helper functions
function hasTag(tags: string[], tagId: string): boolean {
  return tags.includes(tagId);
}

function addTag(tags: string[], tagId: string): string[] {
  return tags.concat([tagId]);
}

function removeTag(tags: string[], tagId: string): string[] {
  return tags.filter((tag) => tag !== tagId);
}

function createStatusMessage(color: number, content: string) {
  return {
    flags: ComponentsV2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents((t) => t.setContent(content)),
    ],
  };
}

async function replyOrDelete(
  ctx: ChatInputCommandInteraction,
  message: string,
  isThreadOwner: boolean,
) {
  if (isThreadOwner) {
    return ctx.deleteReply();
  }
  return ctx.editReply(message);
}

export const data = new SlashCommandBuilder()
  .setName("question")
  .setDescription("Manage support questions")
  .setContexts(0)
  .addSubcommand((sub) =>
    sub.setName("solve").setDescription("Mark the post as solved"),
  )
  .addSubcommand((sub) =>
    sub.setName("unsolve").setDescription("Mark the post as unsolved"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("dev")
      .setDescription("Mark the post for review by a developer"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("wrong-channel")
      .setDescription(
        "Mark the post as being in the wrong channel | Locks the post!",
      )
      .addChannelOption((op) =>
        op
          .setName("correct-channel")
          .setDescription(
            "The correct channel for this question | Ignored, when open-ticket is True",
          )
          .setRequired(false)
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildForum,
            ChannelType.PublicThread,
            ChannelType.GuildVoice,
          ),
      )
      .addBooleanOption((op) =>
        op
          .setName("open-ticket")
          .setDescription("If True, adds a note for the user to open a ticket ")
          .setRequired(false),
      ),
  );

export async function run(ctx: ChatInputCommandInteraction) {
  if (
    !ctx.channel || // TS BS
    ctx.channel.type !== ChannelType.PublicThread ||
    ctx.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM
  ) {
    return await ctx.reply({
      content: "This is the wrong channel my friend.",
    });
  }

  if (!ctx.inCachedGuild()) await ctx.guild!.fetch();

  const subcommand = ctx.options.getSubcommand();

  // Check if the user can update the support post
  const threadOwner = ctx.channel.ownerId;
  const canUpdate = canUpdateSupportPost(
    ctx.member as GuildMember,
    subcommand === "solve" || subcommand === "unsolve" ? threadOwner : null,
  );

  if (!canUpdate) {
    const reason =
      subcommand === "solve" || subcommand === "unsolve"
        ? "Only the author or a staff member can do this."
        : "Only a staff member can do this.";

    await ctx.reply({
      flags: EphemeralV2Flags,
      components: [
        new TextDisplayBuilder().setContent(
          "### :x: You are not authorized to mark this post for review by a developer.\n" +
            `-# ${reason}`,
        ),
      ],
    });
    return;
  }

  await ctx.deferReply({ flags: 64 });

  const currentTags = ctx.channel.appliedTags || [];
  const isThreadOwner = threadOwner === ctx.user.id;

  switch (subcommand) {
    case "solve":
      if (hasTag(currentTags, config.supportTags.solved)) {
        return ctx.editReply("This post is already marked as solved.");
      }

      await ctx.channel.edit({
        appliedTags: addTag(currentTags, config.supportTags.solved),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      });
      await ctx.channel.send(
        createStatusMessage(
          Colors.Green,
          "### ✅ The post has been marked as solved.\nThank y'all for helping!",
        ),
      );

      return replyOrDelete(ctx, "Post marked as solved.", isThreadOwner);

    case "unsolve":
      if (!hasTag(currentTags, config.supportTags.solved)) {
        return ctx.editReply("This post is not marked as solved.");
      }

      await ctx.channel.edit({
        appliedTags: removeTag(currentTags, config.supportTags.solved),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      });
      await ctx.channel.send(
        createStatusMessage(
          Colors.DarkBlue,
          "### 🔓 The post has been unsolved." +
            (isThreadOwner
              ? `\n<@${threadOwner}>, please respond why you have unsolved your post.`
              : ""),
        ),
      );

      return replyOrDelete(ctx, "Post marked as unsolved.", isThreadOwner);

    case "dev":
      if (hasTag(currentTags, config.supportTags.dev)) {
        return ctx.editReply(
          "This post is already marked for developer review.",
        );
      }
      if (hasTag(currentTags, config.supportTags.solved)) {
        return ctx.editReply(
          "A solved post cannot be marked for developer review. Unsolve it first.",
        );
      }

      await ctx.channel.setAppliedTags(
        addTag(currentTags, config.supportTags.dev),
      );
      await ctx.channel.send(
        createStatusMessage(
          Colors.Orange,
          "### 🛠️ The post has been marked for developer review.\nA developer will look into this as soon as possible. Please be patient OP.",
        ),
      );

      return ctx.editReply("Post marked for developer review.");

    case "wrong-channel":
      if (hasTag(currentTags, config.supportTags.wrongChannel)) {
        return ctx.editReply(
          "This post is already marked as being in the wrong channel.",
        );
      }

      const correctChannel = ctx.options.getChannel("correct-channel", false, [
        ChannelType.GuildText,
        ChannelType.GuildForum,
        ChannelType.PublicThread,
        ChannelType.GuildVoice,
      ]);
      const openTicket = ctx.options.getBoolean("open-ticket") ?? false;

      let replyText = `### ✖️ This is the wrong channel for your question <@${threadOwner}>!`;
      if (openTicket) {
        replyText += `\n\nIf you need further assistance, please open a support ticket in <#${config.channels.ticketSupport}>.`;
      } else if (correctChannel) {
        replyText += `\n\nPlease use <#${correctChannel.id}> for your question.`;
      }

      await ctx.channel.send({
        ...createStatusMessage(Colors.Red, replyText),
        allowedMentions: { users: [threadOwner] },
      });

      await ctx.editReply("Post marked as being in the wrong channel.");

      return ctx.channel.edit({
        locked: true,
        appliedTags: addTag(currentTags, config.supportTags.wrongChannel),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      });

    default:
      return ctx.editReply("Unknown subcommand.");
  }
}
