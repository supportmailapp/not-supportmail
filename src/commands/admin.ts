import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import adminSend from "./utils/adminSend.js";
import { syncVotes } from "../cron/syncVotes.js";
import { EphemeralComponentsV2Flags } from "../utils/enums.js";

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
    )
    .addSubcommand((sub) =>
      sub.setName("sync-votes").setDescription("Sync votes and remove roles")
    ),

  async run(ctx: ChatInputCommandInteraction) {
    const subcommand = ctx.options.getSubcommand(true);

    switch (subcommand) {
      case "send":
        await adminSend(ctx);
        break;
      case "sync-votes":
        await syncVotes();
        await ctx.reply({
          flags: EphemeralComponentsV2Flags,
          components: [
            new TextDisplayBuilder().setContent(
              "Votes synced and roles removed successfully!"
            ),
          ],
        });
        break;
    }
  },
};
