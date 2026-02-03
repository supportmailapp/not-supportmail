import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import config from "../config";
import { EphemeralFlags } from "../utils/enums";
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
  const page = await buildBugsLeaderboardPage(pageNum, hidden);
  await ctx.editReply(page);
  if (!hidden) {
    lastUsed = dayjs();
  }
}
