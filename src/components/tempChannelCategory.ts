import { ButtonInteraction, Colors } from "discord.js";
import { TempChannelCategory } from "../models/tempChannel.js";
import { EphemeralV2Flags } from "../utils/enums.js";
import { parseCustomId } from "../utils/main.js";
import { buildCategoryInfo, ErrorResponse } from "../utils/tempChannels.js";

export async function run(ctx: ButtonInteraction) {
  const { component, firstParam: categoryId } = parseCustomId(ctx.customId);

  if (component === "info") {
    await showInfo(ctx as ButtonInteraction, categoryId!);
  } else {
    await ctx.reply(
      ErrorResponse("This action is not supported in this context."),
    );
  }
}

async function showInfo(ctx: ButtonInteraction, categoryId: string) {
  const category = await TempChannelCategory.findById(categoryId);
  if (!category) {
    await ctx.reply(ErrorResponse("Category invalid or not found."));
    return;
  }

  await ctx.reply({
    flags: EphemeralV2Flags,
    components: [buildCategoryInfo(category, true, Colors.Blue)],
  });
}
