import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { EphemeralV2Flags } from "../utils/enums.js";
import adminSend from "./utils/adminSend.js";

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin commands")
    .setDefaultMemberPermissions(8)
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send the feature request sticky message")
        .addStringOption((op) =>
          op
            .setName("option")
            .setDescription("Option")
            .setRequired(true)
            .setChoices(
              {
                value: "featureRequestSticky",
                name: "Feature Request Sticky",
              },
              {
                value: "supportPanel",
                name: "Support Panel",
              }
            )
        )
    ),

  async run(ctx: ChatInputCommandInteraction) {
    const subcommand = ctx.options.getSubcommand(true);

    switch (subcommand) {
      case "send":
        await adminSend(ctx);
        break;
      default:
        await ctx.reply({
          flags: EphemeralV2Flags,
          components: [
            new TextDisplayBuilder().setContent(
              "### :x: Invalid subcommand.\n" + "-# Please use `/admin send`."
            ),
          ],
        });
    }
  },
};
