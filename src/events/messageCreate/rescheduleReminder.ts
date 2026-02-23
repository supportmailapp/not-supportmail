import { ChannelType, type Message } from "discord.js";
import { reschedulePostReminderJob } from "../../utils/agendaHelper";
import { SupportPost } from "../../models/supportPosts";

export async function rescheduleReminder(msg: Message) {
  if (
    !msg.inGuild() ||
    msg.author?.bot ||
    msg.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM ||
    msg.channel.type !== ChannelType.PublicThread
  ) {
    return;
  }

  const sp = await SupportPost.findOne({ postId: msg.channel.id });
  if (!sp) {
    return;
  }
  await reschedulePostReminderJob(sp.postId, sp.userId);
}
