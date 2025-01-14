import { ChatInputCommandInteraction } from "discord.js";

export default async function (ctx: ChatInputCommandInteraction) {
  const option = ctx.options.getString("option");
  await ctx.deferReply({ ephemeral: true });

  if (option === "send") {
    await ctx.channel.send(`Test ${Randomstring.generate(10)}`);
    await ctx.editReply("Sent");
  }
}
