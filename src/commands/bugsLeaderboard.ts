import {
  ChatInputCommandInteraction,
  ComponentType,
  SlashCommandBuilder,
} from "discord.js";
import config from "../config";
import { ComponentsV2Flags, EphemeralFlags } from "../utils/enums";
import { buildBugsLeaderboardPage } from "../utils/main";
import dayjs from "dayjs";

export const data = new SlashCommandBuilder()
  .setName("bugs-leaderboard")
  .setDescription("Show the leaderboard of those who have reported bugs.")
  .addIntegerOption((op) =>
    op
      .setName("page")
      .setDescription("The page number to view. Defaults to 1.")
      .setMinValue(1)
      .setMaxValue(999),
  );

let lastUsed = dayjs(0);

export async function run(ctx: ChatInputCommandInteraction) {
  const hidden =
    ctx.channelId !== config.channels.botCommands ||
    (ctx.channelId === config.channels.botCommands &&
      dayjs().subtract(10, "minutes").isBefore(lastUsed));
  let baseFlags = hidden ? EphemeralFlags : undefined;
  await ctx.deferReply({ flags: baseFlags });

  const pageNum = ctx.options.getInteger("page") ?? 1;
  const page = await buildBugsLeaderboardPage(ctx.user.id, pageNum, hidden);
  const reply = await ctx.editReply(page);
  if (!hidden) {
    lastUsed = dayjs();

    try {
      await reply.awaitMessageComponent({
        filter: (i) => i.user.id === ctx.user.id,
        time: 600_000, // 10 minutes
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
