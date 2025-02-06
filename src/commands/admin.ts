import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import adminSend from "./utils/adminSend.js";
import adminTest from "./utils/adminTest.js";

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin commands")
    .setDefaultMemberPermissions(8)
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Test")
        .addStringOption((op) =>
          op
            .setName("message-id")
            .setDescription(
              "Message ID to edit | if not provided, will send a test message"
            )
            .setRequired(false)
        )
    )
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
      case "test":
        return adminTest(ctx);
      case "send":
        return adminSend(ctx);
    }
  },
};
