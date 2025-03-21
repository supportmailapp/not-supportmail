import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Ping Pong"),

  async run(ctx: ChatInputCommandInteraction) {
    const sent = await ctx.reply({
      content: "Pinging...",
      flags: 64,
      withResponse: true,
    });

    const wsPing = ctx.client.ws.ping;
    const guildPing = sent.interaction.createdTimestamp - ctx.createdTimestamp;

    await ctx.editReply({
      content: "",
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
