import { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { DBStickyMessage } from "../../models/stickyMessage.js";
import { sendRequestSticky } from "../../utils/requestsUtils.js";

export default async function (ctx: ChatInputCommandInteraction) {
  const option = ctx.options.getString("option");
  await ctx.deferReply({ flags: 64 });

  switch (option) {
    case "featureRequestSticky": {
      const channel = (await ctx.guild.channels.fetch(
        process.env.CHANNEL_FEATURE_REQUESTS
      )) as TextChannel;
      const currentMessage = await DBStickyMessage.findOneAndDelete({
        channelId: channel.id,
      });

      if (currentMessage) {
        await channel.messages
          .delete(currentMessage.messageId)
          .catch(() => null);
      }

      const sticky = await sendRequestSticky(channel);

      await DBStickyMessage.create({
        channelId: channel.id,
        messageId: sticky.id,
      });
      break;
    }
    default:
      await ctx.editReply("## ❌ Invalid option provided.");
      return;
  }

  await ctx.editReply("## ✅ Done!");
}
