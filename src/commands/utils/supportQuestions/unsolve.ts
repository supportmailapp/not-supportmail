import {
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
import {
  filterExternalPostTags,
  getCommandMention,
} from "../../../utils/main.js";
import config from "../../../config.js";
import dayjs from "dayjs";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unsolve")
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
  if (post.closedAt === null) {
    await ctx.reply({
      flags: EphemeralComponentsV2Flags,
      components: [
        new TextDisplayBuilder().setContent(
          "### :x: This support question is not marked as solved yet.\n" +
            `-# If you want to resolve it, use the ${await getCommandMention(
              "question solve",
              ctx.client
            )} command.`
        ),
      ],
    });
    return;
  }

  await ctx.deferReply();

  await channel.edit({
    appliedTags: [
      ...filterExternalPostTags(channel.appliedTags),
      config.tags.unanswered,
    ],
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
  });

  await post.updateOne({
    closedAt: null,
    remindedAt: null,
    lastActivity: dayjs().toDate(),
    helped: [],
    $unset: {
      ignoreFlags: "",
      flags: "",
    },
  });

  const comps: TopLevelMessageComponent[] = [
    new ContainerBuilder().addTextDisplayComponents((t) =>
      t.setContent(`### 🔄 Support Post unsolved by <@${ctx.user.id}>.`)
    ),
  ];

  const reason = ctx.options.getString("reason", false) ?? null;

  if (reason) {
    (comps[0] as ContainerBuilder).addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    comps.push(
      new TextDisplayBuilder().setContent(
        `**__Reason__**:\n>>> ${reason}`.trim()
      )
    );
  }

  await ctx.editReply({
    flags: ComponentsV2Flags,
    components: comps,
  });
}
