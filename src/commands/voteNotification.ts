import {
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { DBUser } from "../models/user.js";
import { EphemeralFlags, EphemeralV2Flags } from "../utils/enums.js";

export default {
  data: new SlashCommandBuilder()
    .setName("vote-notification")
    .setDescription("Toggle vote role loss DMs")
    .setContexts(0, 1)
    .addBooleanOption((op) =>
      op
        .setName("get-dm")
        .setDescription(
          "Whether to get DMs when vote roles are lost | Default: True"
        )
        .setRequired(true)
    ),

  async run(ctx: ChatInputCommandInteraction) {
    await ctx.deferReply({ flags: EphemeralFlags });
    const getDM = ctx.options.getBoolean("get-dm", true);

    await DBUser.updateOne(
      { id: ctx.user.id },
      { voteLooseDM: getDM },
      { upsert: true }
    );

    return ctx.editReply({
      flags: EphemeralV2Flags,
      components: [
        new ContainerBuilder()
          .setAccentColor(getDM ? Colors.Green : Colors.Red)
          .addTextDisplayComponents((t) =>
            t.setContent(
              getDM
                ? "✅ You will __now receive DMs__ when you lose vote roles."
                : "✅ You will __no longer receive DMs__ when you lose vote roles."
            )
          ),
      ],
    });
  },
};
