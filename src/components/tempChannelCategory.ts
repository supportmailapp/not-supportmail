import { ButtonInteraction, Colors } from "discord.js";
import { TempChannelCategory } from "../models/tempChannel.js";
import { EphemeralComponentsV2Flags } from "../utils/enums.js";
import { parseCustomId } from "../utils/main.js";
import { buildCategoryInfo, ErrorResponse } from "../utils/tempChannels.js";

async function run(ctx: ButtonInteraction) {
  const { component, params } = parseCustomId(ctx.customId);
  const categoryId = params![0];

  if (component === "info") {
    await showInfo(ctx as ButtonInteraction, categoryId);
  } else {
    await ctx.reply(
      ErrorResponse("This action is not supported in this context.")
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
    flags: EphemeralComponentsV2Flags,
    components: [buildCategoryInfo(category, true, Colors.Blue)],
  });
}

export default {
  prefix: "tempChannelCategory",
  run,
};
