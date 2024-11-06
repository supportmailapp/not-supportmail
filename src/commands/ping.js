import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from "discord.js";

export default {
  // Set to `true` if you want it to be removed.
  // ignore: false,

  // The guild ids where this command should be registered. More details: https://github.com/The-LukeZ/djsCommandHelper?tab=readme-ov-file#delete-a-guild-command
  // guildIds: [],

  data: new SlashCommandBuilder().setName("ping").setDescription("Ping Pong"),

  /** @param {ChatInputCommandInteraction} ctx */
  async run(ctx) {
    const sent = await ctx.reply({
      content: "Pinging...",
      ephemeral: true,
      fetchReply: true,
    });

    const wsPing = client.ws.ping;
    const guildPing = sent.createdTimestamp - ctx.createdTimestamp;

    await ctx.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Pong")
          .setDescription(
            `API Ping: \`${wsPing}ms\`\nRoundtrip latency: \`${guildPing}ms\``
          )
          .setColor(0x44ff44)
          .setTimestamp(Date.now()),
      ],
    });
  },

  // Autocomplete, if needed
  /** @param {AutocompleteInteraction} ctx */
  async autocomplete(ctx) {
    // ...
  },
};
