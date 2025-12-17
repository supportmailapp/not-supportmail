import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import humanizeDuration from "humanize-duration";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import pingCache from "../caches/pingCache.js";
import { ComponentsV2Flags, EphemeralV2Flags } from "../utils/enums.js";
import { randomColor } from "../utils/main.js";

dayjs.extend(duration);

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Ping Pong"),

  async run(ctx: ChatInputCommandInteraction) {
    const bot = ctx.client;

    const startTime = dayjs();
    await ctx.reply({
      flags: EphemeralV2Flags,
      components: [
        new TextDisplayBuilder().setContent("Pong! Calculating latency..."),
      ],
    });

    const endTime = dayjs();
    const latency = endTime.diff(startTime, "milliseconds");
    await ctx
      .editReply({
        flags: ComponentsV2Flags,
        components: [
          new ContainerBuilder()
            .setAccentColor(randomColor())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `- **API Ping:** \`${bot.ws.ping.toFixed(1)}ms\`\n` +
                  `- **Roundtrip Latency:** \`${latency.toFixed(1)}ms\`\n` +
                  `- **Uptime:** \`${humanizeDuration(bot.uptime, {
                    largest: 4,
                    maxDecimalPoints: 1,
                  })}\``
              )
            ),
        ],
      })
      .catch(() => {});

    pingCache.set(ctx.guildId || ctx.channelId, new Date());
  },
};
