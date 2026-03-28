import { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { Notice } from "../models/notice.js";
import {
  buildErrorMessage,
  buildSuccessMessage,
  parseCustomId,
} from "../utils/main.js";

export const prefix = "notice";

type NoticeComponent = "notify" | "create" | "edit";

export async function run(ctx: ButtonInteraction | ModalSubmitInteraction) {
  if (!ctx.channel) return; // how can this happen duh

  const { component } = parseCustomId(ctx.customId) as {
    component: NoticeComponent;
  };

  await ctx.deferReply({ flags: 64 });

  if (component === "notify") {
    const activeNotice = await Notice.findOne({ isActive: true });

    if (!activeNotice) {
      return ctx.reply(buildErrorMessage("This notice is no longer active."));
    }

    if (activeNotice.notifyThreads[ctx.channel.id]?.includes(ctx.user.id)) {
      const newNotices = activeNotice.notifyThreads[ctx.channel.id]!.filter(
        (id) => id !== ctx.user.id,
      );
      activeNotice.notifyThreads[ctx.channel.id] = newNotices;
      await activeNotice.save();

      return ctx.reply(
        buildSuccessMessage(
          "You will no longer receive a notification for this notice in this post.",
        ),
      );
    }

    activeNotice.notifyThreads[ctx.channel.id] = [
      ...(activeNotice.notifyThreads[ctx.channel.id] || []),
      ctx.user.id,
    ];
    await activeNotice.save();

    return ctx.reply(
      buildSuccessMessage(
        "You will now receive a notification for this notice in this post.",
      ),
    );
  }
  if (ctx.isButton()) {
    return ctx.reply(buildErrorMessage("How did we get here??"));
  }

  if (component === "create") {
    const existingActive = await Notice.findOne({ isActive: true });
    if (existingActive) {
      return ctx.reply(
        buildErrorMessage(
          "There is already an active notice. Please resolve it before creating a new one.",
        ),
      );
    }

    const message = ctx.fields.getTextInputValue("message");
    await Notice.create({
      message: message,
    });

    return ctx.reply(
      buildSuccessMessage(
        "Notice created successfully! It will be active until you resolve it.",
      ),
    );
  }

  if (component === "edit") {
    const activeNotice = await Notice.findOne({ isActive: true });
    if (!activeNotice) {
      return ctx.reply(buildErrorMessage("There is no active notice to edit."));
    }

    const message = ctx.fields.getTextInputValue("message");
    activeNotice.message = message;
    await activeNotice.save();

    return ctx.reply(buildSuccessMessage("Notice updated successfully!"));
  }
}
