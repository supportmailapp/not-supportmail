import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { voteMessage } from "../utils/main.js";
import { EphemeralV2Flags } from "../utils/enums.js";

export const data = new SlashCommandBuilder()
  .setName("vote")
  .setDescription("Vote for the bots!");

export async function run(ctx: ChatInputCommandInteraction) {
  return ctx.reply({
    flags: EphemeralV2Flags,
    components: voteMessage.components,
  });
}
