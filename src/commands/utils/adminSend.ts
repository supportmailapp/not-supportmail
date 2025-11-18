import { ChatInputCommandInteraction } from "discord.js";

export default async function (ctx: ChatInputCommandInteraction) {
  const option = ctx.options.getString("option");
  await ctx.deferReply({ flags: 64 });

  switch (option) {
    default:
      await ctx.editReply("## ❌ Invalid option provided.");
      return;
  }

  // await ctx.editReply("## ✅ Done!");
}
