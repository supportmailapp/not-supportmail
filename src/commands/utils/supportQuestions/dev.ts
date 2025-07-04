import {
  ContainerBuilder,
  SeparatorBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ThreadAutoArchiveDuration,
  type ChatInputCommandInteraction,
  type GuildMember,
  type PublicThreadChannel,
} from "discord.js";
import type { HydratedDocument } from "mongoose";
import config from "../../../config.js";
import { SupportPost, type ISupportPost } from "../../../models/supportPost.js";
import {
  ComponentsV2Flags,
  EphemeralComponentsV2Flags,
} from "../../../utils/enums.js";
import {
  canUpdateSupportPost,
  filterExternalPostTags,
  PriorityOption,
  setPostPriority,
} from "../../../utils/main.js";
import * as Sentry from "@sentry/node";

export const data = new SlashCommandSubcommandBuilder()
  .setName("dev")
  .setDescription("Mark a support question for review by a developer")
  .addBooleanOption((opt) =>
    opt
      .setName("ping")
      .setDescription(
        "Ping developers to notify them about this post (default: false)"
      )
      .setRequired(false)
  )
  .addStringOption(PriorityOption(false));

export async function handler(
  ctx: ChatInputCommandInteraction,
  channel: PublicThreadChannel,
  post: HydratedDocument<ISupportPost>
): Promise<void> {
  if (!canUpdateSupportPost(ctx.member as GuildMember)) {
    await ctx.reply({
      flags: EphemeralComponentsV2Flags,
      components: [
        new TextDisplayBuilder().setContent(
          "### :x: You are not authorized to mark this post for review by a developer.\n" +
            "-# Only a staff member can do that."
        ),
      ],
    });
    return;
  }

  if (channel.appliedTags.includes(config.tags.review)) {
    await ctx.reply({
      flags: EphemeralComponentsV2Flags,
      components: [
        new TextDisplayBuilder().setContent(
          "### :x: This post is already marked for review."
        ),
      ],
    });
    return;
  }

  await SupportPost.updateOne(
    {
      postId: post.postId,
    },
    {
      remindedAt: null,
      ignoreFlags: {
        reminder: true,
        close: true,
      },
      flags: {
        noArchive: true,
      },
    }
  );

  const comps: TopLevelMessageComponent[] = [
    new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(
        "### ✅ Post Marked for Review\n" +
          "The post has been marked for review by a developer. Please wait for a response."
      )
    ),
  ];

  const priority = ctx.options.getString("priority") as PriorityLevel;

  // Keep current priority tags, add the review tag
  const newTags = [
    ...filterExternalPostTags(channel.appliedTags, "all"),
    config.tags.review,
  ];
  if (priority) {
    let priorityTag = await setPostPriority(post, priority);
    if (priorityTag && !newTags.includes(priorityTag)) {
      newTags.push(priorityTag);
    }
    comps.push(
      new TextDisplayBuilder().setContent(`-# Priority set to **${priority}**`)
    );
  }

  await channel.edit({
    appliedTags: newTags,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
  });

  if (ctx.options.getBoolean("ping")) {
    if (process.env.ROLE_DEVELOPER) {
      comps.push(
        new SeparatorBuilder({ divider: true, spacing: 1 }),
        new TextDisplayBuilder().setContent(
          `-# <@&${process.env.ROLE_DEVELOPER}>`
        )
      );
    } else {
      console.warn(
        "ROLE_DEVELOPER environment variable is not set. Cannot ping developers."
      );
      Sentry.logger.warn(
        "ROLE_DEVELOPER environment variable is not set. Cannot ping developers."
      );
    }
  }

  await ctx.reply({
    flags: ComponentsV2Flags,
    components: comps,
    allowedMentions: { parse: ["roles"] },
  });
  return;
}
