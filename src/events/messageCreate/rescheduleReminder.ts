import { ChannelType, type Message } from "discord.js";
import { reschedulePostReminderJob } from "../../utils/agendaHelper";
import { SupportPost } from "../../models/supportPosts";
import { getAgenda } from "../../scheduler/agenda";
import type { JobsResult } from "agenda";
import dayjs from "dayjs";

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

  // Only reschedule if the reminder is due within 20 hours
  // (i.e., recent activity should push back an imminent reminder)
  const agenda = getAgenda();
  const jobs = await agenda.queryJobs({
    name: "postReminder",
    data: { postId: sp.postId },
  });
  const job = (jobs as JobsResult<any>).jobs?.[0];
  if (job?.nextRunAt && dayjs(job.nextRunAt).diff(dayjs(), "hour") > 20) {
    return; // reminder is already fresh, skip expensive reschedule
  }

  await reschedulePostReminderJob(sp.postId, sp.userId);
}
