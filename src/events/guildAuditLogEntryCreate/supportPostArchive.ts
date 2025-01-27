import {
  AuditLogEvent,
  ForumThreadChannel,
  Guild,
  GuildAuditLogsEntry,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { SupportPost } from "../../models/supportPost.js";

export default async function (entry: GuildAuditLogsEntry, guild: Guild) {
  if (
    !(
      entry.actionType == "Update" &&
      entry.action == AuditLogEvent.ThreadUpdate &&
      entry.executorId != guild.client.user.id
    )
  )
    return;

  const supportPost = await SupportPost.findOne({ id: entry.targetId });
  if (!supportPost) return;

  // If the extra field states that the autoarchive duration was updated, adjust it back to 1 day
  const autoArchiveChange = entry.changes.find(
    (c) => c.key == "auto_archive_duration"
  );
  if (autoArchiveChange) {
    const thread = (await guild.channels.fetch(
      entry.targetId
    )) as ForumThreadChannel;
    if (thread) {
      await thread.setAutoArchiveDuration(ThreadAutoArchiveDuration.OneDay);
    }
  }
}
