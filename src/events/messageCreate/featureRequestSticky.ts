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

  const currentMessage = await DBStickyMessage.findOneAndDelete({
    channelId: message.channel.id,
  });

  if (currentMessage) {
    await message.channel.messages.delete(currentMessage.messageId);
  }

  const sticky = await sendRequestSticky(message.channel);

  await DBStickyMessage.create({
    channelId: message.channel.id,
    messageId: sticky.id,
  });
  return;
}
