import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { EphemeralV2Flags } from "../utils/enums.js";
import adminSend from "./utils/adminSend.js";
import { listPostReminderJobs } from "../utils/agendaHelper.js";
import { buildErrorMessage, SimpleText } from "../utils/main.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Admin commands")
  .setDefaultMemberPermissions(8)
  .addSubcommand((sub) =>
    sub
      .setName("send")
      .setDescription("Send the feature request sticky message")
      .addStringOption((op) =>
        op
          .setName("option")
          .setDescription("Option")
          .setRequired(true)
          .setChoices(
            {
              value: "featureRequestSticky",
              name: "Feature Request Sticky",
            },
            {
              value: "supportPanel",
              name: "Support Panel",
            },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("next-reminders")
      .setDescription("List the next 50 scheduled post reminder jobs"),
  );

export async function run(ctx: ChatInputCommandInteraction) {
  const subcommand = ctx.options.getSubcommand(true);

  switch (subcommand) {
    case "send":
      await adminSend(ctx);
      break;
    case "next-reminders":
      const jobs = await listPostReminderJobs();
      if (jobs.length === 0) {
        return ctx.reply(
          buildErrorMessage("No scheduled post reminder jobs found."),
        );
      }
      return ctx.reply({
        flags: EphemeralV2Flags,
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            SimpleText("### Next 50 Scheduled Post Reminder Jobs"),
            SimpleText(
              jobs
                .map(
                  (job) =>
                    `- <#${job.postId}> | <@${job.userId}> | <t:${job.nextRunAt}:F>`,
                )
                .join("\n"),
            ),
          ),
        ],
      });
    default:
      await ctx.reply({
        flags: EphemeralV2Flags,
        components: [
          new TextDisplayBuilder().setContent(
            "### :x: Invalid subcommand.\n" + "-# Please use `/admin send`.",
          ),
        ],
      });
  }
}
