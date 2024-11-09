import { ChannelType, Message } from "discord.js";
import { DBStickyMessage } from "../../models/stickyMessage.js";
import { sendRequestSticky } from "../../utils/requestsUtils.js";
const { featureRequestChannel } = (
  await import("../../../config.json", { with: { type: "json" } })
).default;

export default async function featureRequestSticky(message: Message) {
  if (
    message.channel.id !== featureRequestChannel ||
    message.channel.type != ChannelType.GuildText
  )
    return;

  const currentMessage = await DBStickyMessage.findOne({
    channelId: message.channel.id,
  });

  if (currentMessage) {
    await message.channel.messages
      .delete(currentMessage.messageId)
      .catch(() => null);
  }

  const sticky = await sendRequestSticky(message.channel);

  if (currentMessage)
    await currentMessage.updateOne({
      messageId: sticky.id,
    });
  else
    await DBStickyMessage.create({
      channelId: message.channel.id,
      messageId: sticky.id,
    });
  return;
}
