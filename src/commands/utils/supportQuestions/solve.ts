import {
  ButtonBuilder,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  type PublicThreadChannel,
  SeparatorSpacingSize,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import type { ISupportPost } from "../../../models/supportPost.js";
import type { HydratedDocument } from "mongoose";
import {
  ComponentsV2Flags,
  EphemeralComponentsV2Flags,
} from "../../../utils/enums.js";
import { getCommandMention } from "../../../utils/main.js";
import config from "../../../config.js";
import dayjs from "dayjs";
import * as UsersCache from "../../../caches/helpfulUsers.js";

export const data = new SlashCommandSubcommandBuilder()
  .setName("solve")
  .setDescription("Mark a support question as solved")
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for marking as solved")
      .setRequired(false)
  );

export async function handler(
  ctx: ChatInputCommandInteraction,
  channel: PublicThreadChannel,
  post: HydratedDocument<ISupportPost>
): Promise<void> {
  if (post.closedAt !== null) {
    await ctx.reply({
      flags: EphemeralComponentsV2Flags,
      components: [
        new TextDisplayBuilder().setContent(
          "### :x: This support question is already marked as solved.\n" +
            `-# If you want to unsolve it, use the ${getCommandMention(
              "question unsolve",
              ctx.client
            )} command.`
        ),
      ],
    });
    return;
  }

  await ctx.deferReply();

  const tags = channel.appliedTags;
  await channel.edit({
    appliedTags: [
      ...tags.filter((tid) => !Object.values(config.tags).includes(tid)),
      config.tags.solved,
    ],
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  });

  await post.updateOne({
    closedAt: dayjs().toDate(),
  });

  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(
      `### ✅ Support Post has been marked as solved by <@${ctx.user.id}>, thanks everyone!`
    )
  );
  const reason = ctx.options.getString("reason", false) ?? null;

  if (reason) {
    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents((t) =>
      t.setContent(`**__Reason__**:\n>>> ${reason}`.trim())
    );
  }

  container.addActionRowComponents((a) =>
    a.setComponents(
      new ButtonBuilder({
        customId: "helpful",
        label: "Select users",
        style: 1,
        emoji: {
          name: "🙌",
        },
      })
    )
  );

  await ctx.editReply({
    flags: ComponentsV2Flags,
    components: [container],
  });

  await UsersCache.fetchAndCacheThreadMembers(
    channel,
    post.author,
    ctx.client.user.id,
    post.helped
  );
}
