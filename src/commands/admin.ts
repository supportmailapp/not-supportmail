import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
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

  run(ctx: ChatInputCommandInteraction) {
    const subcommand = ctx.options.getSubcommand(true);

    switch (subcommand) {
      case "send":
        return adminSend(ctx);
    }
  },
};
