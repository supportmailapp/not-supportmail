import { ChatInputCommandInteraction, Message } from "discord.js";
import { randomBytes } from "crypto";
import NodeCache from "node-cache";

// Stores message objects
let cache = new NodeCache({
  stdTTL: 300,
  arrayValueSize: 1000,
  errorOnMissing: false,
});

export default async function (ctx: ChatInputCommandInteraction) {
  // const messageId = ctx.options.getString("message-id", false);
  await ctx.deferReply({ flags: "Ephemeral" });

  const messageData = cache.get(ctx.channelId) as
    | { message: Message<true> }
    | undefined;

  if (!messageData || !messageData?.message) {
    const _message = await ctx.channel.send(
      `Test ${randomBytes(10).toString("hex")}`
    );
    cache.set(ctx.channelId, { message: _message });
    await ctx.editReply("Sent");
  } else {
    console.log("message.client", messageData.message.client);
    await messageData.message
      .edit(`Test ${randomBytes(10).toString("hex")}`)
      .catch(console.error);
    await ctx.editReply(
      `Edited; message.client exists? ${!!messageData.message.client}`
    );
  }
}
