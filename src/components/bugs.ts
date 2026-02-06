import {
  ComponentType,
  LabelBuilder,
  ModalBuilder,
  type ButtonInteraction,
  type ModalMessageModalSubmitInteraction,
} from "discord.js";
import { ComponentsV2Flags, EphemeralFlags } from "../utils/enums";
import {
  buildBugsLeaderboardPage,
  buildErrorMessage,
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
  const [userId, pageStr, totalBuggersStr] = params as [string, string, string];
  const totalBuggers = safeParseInt(totalBuggersStr, 0, 0);
  const maxPages = Math.max(1, Math.ceil(totalBuggers / 10));

  if (ctx.isButton()) {
    if (ctx.user.id !== userId) {
      return ctx.reply(
        buildErrorMessage("You didn't initiate this interaction!"),
      );
    }

    if (component === "set") {
      return ctx.showModal(
        new ModalBuilder()
          .setTitle("Set Bugs Leaderboard Page")
          .setCustomId(`bugs/set?${userId}/${pageStr}/${totalBuggersStr}`)
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

  const page = await buildBugsLeaderboardPage(ctx.user.id, pageNum, false);
  const reply = await ctx.editReply(page);

  if (!reply.flags.has(EphemeralFlags)) {
    try {
      await reply.awaitMessageComponent({
        filter: (i) => i.user.id === ctx.user.id,
        time: 300_000, // 5 minutes
      });
    } catch {
      await ctx.editReply({
        flags: ComponentsV2Flags,
        components: page.components!.filter(
          (c) =>
            ("type" in c && c.type !== ComponentType.ActionRow) ||
            ("toJSON" in c && c.toJSON().type !== ComponentType.ActionRow),
        ),
      });
    }
  }
}
