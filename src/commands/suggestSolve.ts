import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { EphemeralV2Flags } from "../utils/enums";
import { buildErrorMessage, buildSuggestSolveMessage } from "../utils/main";

export const data = new SlashCommandBuilder()
  .setName("suggest-solve-send")
  .setDescription("Manually send a suggest solve message in a support thread");

export async function run(ctx: ChatInputCommandInteraction) {
  await ctx.deferReply({ flags: EphemeralV2Flags });

  // Check if the command is being used in a support thread
  if (
    !ctx.inGuild() ||
    ctx.channel?.type !== ChannelType.PublicThread ||
    ctx.channel.parentId !== Bun.env.CHANNEL_SUPPORT_FORUM
  ) {
    return ctx.editReply(
      buildErrorMessage(
        "This command can only be used in support forum threads.",
      ),
    );
  }

  // Check if the user is the thread owner
  if (ctx.channel.ownerId !== ctx.user.id) {
    return ctx.editReply(
      buildErrorMessage(
        "Only the thread owner can manually send the suggest solve message.",
      ),
    );
  }

  // Send the suggest solve message
  const message = await buildSuggestSolveMessage(ctx.client);

  await ctx.channel.send(message);
  await ctx.deleteReply();
}
