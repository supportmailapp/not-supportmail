import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Ping Pong"),

  async run(ctx: ChatInputCommandInteraction) {
    const sent = await ctx.reply({
      content: "Pinging...",
      ephemeral: true,
      fetchReply: true,
    });

    const wsPing = ctx.client.ws.ping;
    const guildPing = sent.createdTimestamp - ctx.createdTimestamp;

    await ctx.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Pong")
          .setDescription(
            `API Ping: \`${wsPing}ms\`\nRoundtrip latency: \`${guildPing}ms\``
          )
          .setColor(Colors.Blurple)
          .setTimestamp(Date.now()),
      ],
    });
  },
};
