import {
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { DBUser } from "../models/user";
import { EphemeralV2Flags } from "../utils/enums";

export const data = new SlashCommandBuilder()
  .setName("suggest-solve-setting")
  .setDescription("Toggle suggest solve setting for you")
  .addStringOption((op) =>
    op
      .setName("setting")
      .setDescription("Do you want to enable or disable solve suggestions?")
      .setRequired(true)
      .setChoices(
        {
          name: "Enabled | Bot will suggest /question solve in support posts of yours",
          value: "true",
        },
        {
          name: "Disabled | Bot will not suggest /question solve in support posts of yours",
          value: "false",
        },
      ),
  );

export async function run(ctx: ChatInputCommandInteraction) {
  const setting = ctx.options.getString("setting", true) === "true";
  await DBUser.updateOne(
    { id: ctx.user.id },
    { suggestSolve: setting },
    { upsert: true },
  );

  await ctx.reply({
    flags: EphemeralV2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(setting ? Colors.Green : Colors.Red)
        .addTextDisplayComponents((t) =>
          t.setContent(
            setting
              ? "✅ Suggest solve has been **enabled**. The bot will now suggest `/question solve` in your support posts."
              : "✅ Suggest solve has been **disabled**. The bot will no longer suggest `/question solve` in your support posts.",
          ),
        ),
    ],
  });
}
