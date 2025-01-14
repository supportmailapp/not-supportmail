import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { randomBytes } from "crypto";

export default async function (ctx: ChatInputCommandInteraction) {
  const messageId = ctx.options.getString("message-id", false);
  await ctx.deferReply({ flags: "Ephemeral" });

  if (!messageId) {
    await ctx.channel.send(`Test ${randomBytes(10).toString("hex")}`);
    await ctx.editReply("Sent");
  } else {
    const channel = (await ctx.guild.channels.fetch(
      ctx.channelId
    )) as TextChannel; // Just to test if it works
    const message = await channel.messages.fetch(messageId);
    console.log("message.client", message.client);
    await message.edit(`Test ${randomBytes(10).toString("hex")}`);
    await ctx.editReply("Edited");
  }
}
