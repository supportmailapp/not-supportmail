import type { Job } from "agenda";
import { client } from "../../client";
import * as Sentry from "@sentry/bun";
import {
  ChannelType,
  ContainerBuilder,
  Routes,
  type APIMessageTopLevelComponent,
} from "discord.js";
import { ComponentsV2Flags } from "../../utils/enums";
import { SimpleText } from "../../utils/main";
import config from "../../config";

const reminderMessages = [
  "Hey <@{userId}>, is your issue resolved?",
  "Just checking in, <@{userId}>! Has your issue been resolved?",
  "Hi <@{userId}>, is your issue resolved?",
];

function getRandomReminderMessage(userId: string) {
  const randomIndex = Math.floor(Math.random() * reminderMessages.length);
  return reminderMessages[randomIndex]!.replace("{userId}", userId);
}

export async function reminderHandler(
  job: Job<{ postId: string; userId: string }>,
) {
  console.log(
    `Reminder job executed for post ID: ${job.attrs.data?.postId}, user ID: ${job.attrs.data?.userId}`,
  );
  const post = await client.channels.fetch(job.attrs.data.postId);
  if (
    !post ||
    post.type !== ChannelType.PublicThread ||
    post.archived ||
    post.locked ||
    post.appliedTags.some(
      (tid) => Object.values(config.supportTags).includes(tid), // All configured tags are tags that, when applied, have an impact on the bot bahavior in general
    )
  ) {
    return;
  }

  try {
    await client.rest.post(Routes.channelMessages(job.attrs.data.userId), {
      body: {
        flags: ComponentsV2Flags,
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              SimpleText(getRandomReminderMessage(job.attrs.data.userId)),
            )
            .toJSON(),
        ] satisfies APIMessageTopLevelComponent[],
      },
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}
