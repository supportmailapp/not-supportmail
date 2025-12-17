import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { voteMessage } from "../utils/main.js";
import { EphemeralV2Flags } from "../utils/enums.js";

export default {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Vote for the bots!"),

  async run(ctx: ChatInputCommandInteraction) {
    return ctx.reply({
      flags: EphemeralV2Flags,
      components: voteMessage.components,
    });
  },
};
