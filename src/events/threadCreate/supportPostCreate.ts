import {
  type AnyThreadChannel,
  ChannelType,
  Colors,
  ContainerBuilder,
} from "discord.js";
import { Notice } from "../../models/notice.js";
import { SupportPost } from "../../models/supportPosts.js";
import { delay, SimpleText, updateDBUsername } from "../../utils/main.js";
import { ComponentsV2Flags } from "../../utils/enums.js";

export async function supportPostCreate(thread: AnyThreadChannel) {
  if (
    thread.type != ChannelType.PublicThread ||
    Bun.env.CHANNEL_SUPPORT_FORUM != thread.parentId
  ) {
    return;
  }

  await thread.join();

  const owner = await thread.guild.members
    .fetch(thread.ownerId)
    .catch(() => null);

  if (owner) {
    await updateDBUsername(
      {
        id: owner.id,
        username: owner.user.username,
        displayName: owner.displayName || owner.user.displayName,
      },
      true,
    );
  }

  // Pin the starter message (has the same ID as the thread)
  await thread.messages.pin(thread.id);

  await delay(1000); // Wait a bit, so the rescheduler doesn't immediately run before the post is created in the DB

  await SupportPost.updateOne(
    {
      postId: thread.id,
      userId: thread.ownerId,
    },
    {
      postId: thread.id,
      userId: thread.ownerId,
    },
    { upsert: true },
  );

  const activeNotice = await Notice.findOne({ isActive: true });
  if (activeNotice) {
    // const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    //   new ButtonBuilder()
    //     .setCustomId("notice/notify")
    //     .setLabel("Notify me when resolved")
    //     .setStyle(ButtonStyle.Primary),
    // );

    await thread.send({
      flags: ComponentsV2Flags,
      components: [
        new ContainerBuilder()
          .setAccentColor(Colors.Orange)
          .addTextDisplayComponents(
            SimpleText("### ⚠️ Active Notice"),
            SimpleText(activeNotice.message),
          )
          .addSeparatorComponents((s) => s)
          .addSectionComponents((sec) =>
            sec
              .addTextDisplayComponents(
                SimpleText(
                  "Click the button to be notified in this post when this is resolved.",
                ),
              )
              .setButtonAccessory((b) =>
                b
                  .setCustomId("notice/notify")
                  .setLabel("Notify me!")
                  .setEmoji({ name: "🔔" })
                  .setStyle(1),
              ),
          ),
      ],
    });
  }
}
