import {
  ChatInputCommandInteraction,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SlashCommandBuilder,
  subtext,
  type APIMessageTopLevelComponent,
  type JSONEncodable,
} from "discord.js";
import { Notice } from "../models/notice.js";
import {
  buildErrorMessage,
  buildSuccessMessage,
  delay,
  SimpleText,
} from "../utils/main.js";
import { ComponentsV2Flags } from "../utils/enums.js";

const RESOLUTION_TEMPLATES = [
  "The notice has been resolved. Thank you for your patience!",
  "Update: The notice has been resolved.",
  "Good news! The notice has been resolved.",
  "The issue mentioned in the notice has been resolved. Thanks for waiting!",
  "The notice is now resolved. Thank you for your patience!",
];

export const data = new SlashCommandBuilder()
  .setName("notice")
  .setDescription("Manage the active support notice")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new active notice for new support posts"),
  )
  .addSubcommand((sub) =>
    sub.setName("edit").setDescription("Edit the currently active notice"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("resolve")
      .setDescription("Resolve the active notice and notify tracked threads")
      .addStringOption((opt) =>
        opt
          .setName("comment")
          .setDescription(
            "Optional comment to include in the resolution message",
          )
          .setRequired(false),
      ),
  );

export async function run(ctx: ChatInputCommandInteraction) {
  const subcommand = ctx.options.getSubcommand();

  if (subcommand === "create") {
    const existingActive = await Notice.findOne({ isActive: true });
    if (existingActive) {
      return ctx.reply(
        buildErrorMessage(
          "There is already an active notice. Please resolve it before creating a new one.",
        ),
      );
    }

    return ctx.showModal(
      new ModalBuilder()
        .setTitle("Create a Notice")
        .setCustomId("notice/create")
        .addLabelComponents((l) =>
          l
            .setLabel("Message")
            .setTextInputComponent((ti) =>
              ti
                .setCustomId("message")
                .setStyle(2)
                .setRequired(true)
                .setMaxLength(2000)
                .setPlaceholder("Notice message here..."),
            ),
        ),
    );
  }

  if (subcommand === "edit") {
    const activeNotice = await Notice.findOne({ isActive: true });
    if (!activeNotice) {
      return ctx.reply(
        buildErrorMessage(
          "There is no active notice to edit. Use /notice create to make one.",
        ),
      );
    }

    return ctx.showModal(
      new ModalBuilder()
        .setTitle("Edit the Active Notice")
        .setCustomId("notice/edit")
        .addLabelComponents((l) =>
          l
            .setLabel("Message")
            .setTextInputComponent((ti) =>
              ti
                .setCustomId("message")
                .setStyle(2)
                .setRequired(true)
                .setMaxLength(2000)
                .setPlaceholder("Notice message here...")
                .setValue(activeNotice.message),
            ),
        ),
    );
  }

  if (subcommand === "resolve") {
    const comment = ctx.options.getString("comment");

    const activeNotice = await Notice.findOne({ isActive: true });
    if (!activeNotice) {
      return ctx.reply({
        content: "There is no active notice to resolve.",
        ephemeral: true,
      });
    }

    await ctx.deferReply({ ephemeral: true });

    if (comment) activeNotice.resolutionComment = comment;
    await activeNotice.save();

    let notifiedCount = 0;
    const threads = activeNotice.notifyThreads || [];

    for (const [threadId, userIds] of Object.entries(threads)) {
      try {
        const thread = await ctx.guild?.channels
          .fetch(threadId)
          .catch(() => null);
        if (thread && thread.isThread()) {
          const randIndex = Math.floor(
            Math.random() * RESOLUTION_TEMPLATES.length,
          );
          const template = RESOLUTION_TEMPLATES[randIndex]!;

          const components: JSONEncodable<APIMessageTopLevelComponent>[] = [
            SimpleText(template),
          ];
          if (comment) {
            components.push(
              new SeparatorBuilder().setDivider(true),
              SimpleText("**Additional Comment:**"),
              SimpleText(comment),
            );
          }

          components.push(
            SimpleText(
              subtext(
                `<@${thread.ownerId}> you can mark this post as solved if your issue has been resolved by this - use </question solve:1352592496642883615>.`,
              ),
            ),
          );

          if (userIds.length > 0) {
            components.push(
              new SeparatorBuilder().setDivider(true),
              SimpleText(
                userIds
                  .map((id) => `<@${id}>`)
                  .join(" ")
                  .slice(0, 2000),
              ),
            );
          }

          await thread.send({
            flags: ComponentsV2Flags,
            allowedMentions:
              userIds.length > 0 ? { users: userIds } : { parse: [] },
            components: components,
          });
          notifiedCount++;
          await delay(900); // ratelimit
        }
      } catch (err) {
        console.error(`Failed to notify thread ${threadId}:`, err);
      }
    }

    await Notice.updateOne({ _id: activeNotice._id }, { isActive: false }); // mark as resolved here, bcuz we don't want to accidentally mark it resolved if there was an error sending messages to threads

    return ctx
      .editReply(
        buildSuccessMessage(
          `Notice resolved and ${notifiedCount} thread(s) notified.`,
        ),
      )
      .catch(() => {}); // one could have dismissed the reply early
  }
}
