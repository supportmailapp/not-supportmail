import {
  LabelBuilder,
  ModalBuilder,
  type ButtonInteraction,
  type ModalMessageModalSubmitInteraction,
} from "discord.js";
import { ComponentsV2Flags } from "../utils/enums";
import {
  buildBugsLeaderboardPage,
  parseCustomId,
  safeParseInt,
  SimpleText,
} from "../utils/main";

export const prefix = "bugs";

export async function run(
  ctx: ButtonInteraction | ModalMessageModalSubmitInteraction,
) {
  let pageNum: number;
  const { component, params } = parseCustomId(ctx.customId) as {
    component: "next" | "back" | "set";
    params: string[];
  };
  const [pageStr, totalBuggersStr] = params as [string, string];
  const totalBuggers = safeParseInt(totalBuggersStr, 0, 0);
  const maxPages = Math.max(1, Math.ceil(totalBuggers / 10));

  if (ctx.isButton()) {
    if (component === "set") {
      return ctx.showModal(
        new ModalBuilder()
          .setTitle("Set Bugs Leaderboard Page")
          .setCustomId("bugs/set")
          .addLabelComponents(
            new LabelBuilder()
              .setLabel("Page")
              .setTextInputComponent((ti) =>
                ti
                  .setCustomId("page")
                  .setPlaceholder(`Min: 1, Max: ${maxPages}`)
                  .setStyle(1)
                  .setMinLength(1)
                  .setMaxLength(3)
                  .setRequired(true),
              ),
          ),
      );
    }

    pageNum = safeParseInt(pageStr, 1, 1, maxPages);
    if (component === "next") {
      pageNum += 1;
    } else {
      pageNum -= 1;
    }
  } else {
    const pageStr = ctx.fields.getTextInputValue("page");
    pageNum = safeParseInt(pageStr, 1, 1, maxPages);
  }

  await ctx.update({
    flags: ComponentsV2Flags,
    components: [SimpleText("⏳")],
  });

  const page = await buildBugsLeaderboardPage(pageNum, false);
  await ctx.editReply(page);
}
