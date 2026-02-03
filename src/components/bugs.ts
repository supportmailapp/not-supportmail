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
  await ctx.update({
    flags: ComponentsV2Flags,
    components: [SimpleText("⏳")],
  });

  let pageNum: number;
  if (ctx.isButton()) {
    const { component, firstParam } = parseCustomId(ctx.customId) as
      | { component: "next" | "back"; firstParam: string }
      | { component: "set"; firstParam: null };

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
                  .setStyle(1)
                  .setMinLength(1)
                  .setMaxLength(3)
                  .setRequired(true),
              ),
          ),
      );
    }

    pageNum = parseInt(firstParam, 10);
    if (component === "next") {
      pageNum += 1;
    } else {
      pageNum -= 1;
    }
  } else {
    const pageStr = ctx.fields.getTextInputValue("page");
    pageNum = safeParseInt(pageStr, 10);
  }

  const page = await buildBugsLeaderboardPage(pageNum, false);
  await ctx.editReply(page);
}
