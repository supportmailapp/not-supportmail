import {
  ChannelType,
  Colors,
  ContainerBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import config from "../config.js";
import { ComponentsV2Flags, EphemeralV2Flags } from "../utils/enums.js";

// Helper functions
function hasTag(tags: string[], tagId: string): boolean {
  return tags.includes(tagId);
}

function addTag(tags: string[], tagId: string): string[] {
  return tags.concat([tagId]);
}

function removeOldStatusTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      tag !== config.suggestionTags.noted &&
      tag !== config.suggestionTags.accepted &&
      tag !== config.suggestionTags.rejected &&
      tag !== config.suggestionTags.implemented &&
      tag !== config.suggestionTags.duplicate,
  );
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

export const data = new SlashCommandBuilder()
  .setName("suggestion")
  .setDescription("Manage suggestions")
  .setContexts(0)
  .addStringOption((op) =>
    op
      .setName("new-status")
      .setDescription("Set the new status for this suggestion")
      .setRequired(true)
      .addChoices(
        { name: "Noted", value: "noted" },
        { name: "Accepted", value: "accepted" },
        { name: "Rejected", value: "rejected" },
        { name: "Implemented", value: "implemented" },
        { name: "Duplicate (Also locks the post)", value: "duplicate" },
      ),
  );

export async function run(ctx: ChatInputCommandInteraction<"cached">) {
  if (
    !ctx.channel ||
    ctx.channel.type !== ChannelType.PublicThread ||
    !ctx.channel.parent ||
    ctx.channel.parent.type !== ChannelType.GuildForum
  ) {
    return await ctx.reply({
      content: "This command can only be used in forum threads.",
      flags: 64,
    });
  }

  const newStatus = ctx.options.getString("new-status", true);

  // Check if the user can update suggestions (staff only)
  const canUpdate = ctx.member.roles.cache.hasAny(
    Bun.env.ROLE_THREAD_MANAGER!,
    Bun.env.ROLE_DEVELOPER!,
  );

  if (!canUpdate) {
    await ctx.reply({
      flags: EphemeralV2Flags,
      components: [
        new ContainerBuilder()
          .setAccentColor(Colors.Red)
          .addTextDisplayComponents((t) =>
            t.setContent(
              "### :x: You are not authorized to manage suggestions.\n" +
                `-# Only thread managers and developers can do this.`,
            ),
          ),
      ],
    });
    return;
  }

  await ctx.deferReply({ flags: 64 });

  const currentTags = ctx.channel.appliedTags || [];
  const threadOwner = ctx.channel.ownerId;

  // Remove old status tags before adding new one
  const tagsWithoutStatus = removeOldStatusTags(currentTags);

  // add dev, if user has dev role
  if (
    Bun.env.ROLE_DEVELOPER &&
    ctx.member.roles.cache.has(Bun.env.ROLE_DEVELOPER) &&
    !ctx.channel.members.cache.has(ctx.user.id)
  ) {
    await ctx.channel.members.add(ctx.user.id);
  }

  switch (newStatus) {
    case "noted": {
      if (hasTag(currentTags, config.suggestionTags.noted)) {
        return ctx.editReply("This suggestion is already marked as noted.");
      }

      await ctx.channel.setAppliedTags(
        addTag(tagsWithoutStatus, config.suggestionTags.noted),
      );
      await ctx.channel.send(
        createStatusMessage(
          Colors.Blue,
          "### 📝 This suggestion has been noted.\nThank you for your feedback!",
        ),
      );

      return ctx.editReply("Suggestion marked as noted.");
    }

    case "accepted": {
      if (hasTag(currentTags, config.suggestionTags.accepted)) {
        return ctx.editReply("This suggestion is already marked as accepted.");
      }

      await ctx.channel.setAppliedTags(
        addTag(tagsWithoutStatus, config.suggestionTags.accepted),
      );
      await ctx.channel.send(
        createStatusMessage(
          Colors.Green,
          `### ✅ This suggestion has been accepted!\nGreat idea <@${threadOwner}>! We'll work on implementing this.`,
        ),
      );

      return ctx.editReply("Suggestion marked as accepted.");
    }

    case "rejected": {
      if (hasTag(currentTags, config.suggestionTags.rejected)) {
        return ctx.editReply("This suggestion is already marked as rejected.");
      }

      await ctx.channel.setAppliedTags(
        addTag(tagsWithoutStatus, config.suggestionTags.rejected),
      );
      await ctx.channel.send(
        createStatusMessage(
          Colors.Red,
          `### ❌ This suggestion has been rejected.\nThank you for your input <@${threadOwner}>, but we've decided not to implement this at this time.`,
        ),
      );

      return ctx.editReply("Suggestion marked as rejected.");
    }

    case "implemented": {
      if (hasTag(currentTags, config.suggestionTags.implemented)) {
        return ctx.editReply(
          "This suggestion is already marked as implemented.",
        );
      }

      await ctx.channel.setAppliedTags(
        addTag(tagsWithoutStatus, config.suggestionTags.implemented),
      );
      await ctx.channel.send(
        createStatusMessage(
          Colors.Gold,
          `### 🎉 This suggestion has been implemented!\nThanks <@${threadOwner}> for the great idea!`,
        ),
      );

      return ctx.editReply("Suggestion marked as implemented.");
    }

    case "duplicate": {
      if (hasTag(currentTags, config.suggestionTags.duplicate)) {
        return ctx.editReply("This suggestion is already marked as duplicate.");
      }

      await ctx.channel.send(
        createStatusMessage(
          Colors.Orange,
          `### 🔁 This suggestion is a duplicate.\n<@${threadOwner}>, this has already been suggested. Please check existing suggestions before posting.`,
        ),
      );

      await ctx.editReply("Suggestion marked as duplicate and thread locked.");

      return ctx.channel.edit({
        locked: true,
        appliedTags: addTag(tagsWithoutStatus, config.suggestionTags.duplicate),
      });
    }

    default:
      return ctx.editReply("Unknown status.");
  }
}
