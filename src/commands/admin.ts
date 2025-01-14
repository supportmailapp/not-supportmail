import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import adminSend from "./utils/adminSend.js";
import adminManualClose from "./utils/adminManualClose.js";
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
          op.setName("action").setDescription("Send or Edit?").setChoices(
            {
              name: "Send",
              value: "send",
            },
            {
              name: "Edit",
              value: "edit",
            }
          )
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
    )
    .addSubcommand((sub) =>
      sub
        .setName("manual-autoclose")
        .setDescription("Manually execute the autoclose scheduler")
    ),

  run(ctx: ChatInputCommandInteraction) {
    const subcommand = ctx.options.getSubcommand(true);

    switch (subcommand) {
      case "test":
        return adminTest(ctx);
      case "send":
        return adminSend(ctx);
      case "manual-autoclose":
        return adminManualClose(ctx);
    }
  },
};
