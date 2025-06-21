import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type PublicThreadChannel,
} from "discord.js";
import type { HydratedDocument } from "mongoose";
import { type ISupportPost } from "../../../models/supportPost.js";
import { PriorityOption, setPostPriority } from "../../../utils/main.js";
import {
  ComponentsV2Flags,
  EphemeralComponentsV2Flags,
} from "../../../utils/enums.js";
import config from "../../../config.js";

export const data = new SlashCommandSubcommandBuilder()
  .setName("priority")
  .setDescription("Set the priority of a support question")
  .addStringOption(PriorityOption(true));

export async function handler(
  ctx: ChatInputCommandInteraction,
  channel: PublicThreadChannel,
  post: HydratedDocument<ISupportPost>
) {
  const priority = ctx.options.getString("priority", true) as PriorityLevel;
  if (channel.appliedTags.includes(config.priorityTags[priority])) {
    await ctx.reply({
      flags: EphemeralComponentsV2Flags,
      components: [
        new ContainerBuilder().addTextDisplayComponents((t) =>
          t.setContent(
            `### :x: This post is already marked with **${priority}** priority.`
          )
        ),
      ],
    });
    return;
  }
  await setPostPriority(post, priority, channel);

  await ctx.reply({
    flags: ComponentsV2Flags,
    components: [
      new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          `Priority set to **${priority}** for this support question.`
        )
      ),
    ],
  });
  return;
}
