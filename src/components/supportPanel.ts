import {
  ActionRowBuilder,
  Attachment,
  ButtonInteraction,
  Colors,
  EmbedBuilder,
  ForumChannel,
  ModalBuilder,
  ModalMessageModalSubmitInteraction,
  TextInputBuilder,
  ThreadAutoArchiveDuration,
  User,
} from "discord.js";

import { parseCustomId } from "../utils/main.js";
import dayjs from "dayjs";
import {
  SupportQuestion,
  SupportQuestionField,
  SupportQuestionLabelMap,
  SupportQuestionType,
  SupportQuestionTypeMap,
} from "../models/supportQuestion.js";
import { HydratedDocument } from "mongoose";
import supportPostCooldown from "../caches/supportPostCooldown.js";
import bugReportHandler from "./utils/bugReportHandler.js";

const { featureRequestChannel, supportForumId, supportTags } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

const PREFIX = "supportPanel";

/*
Available component parameters:

- generalQuestion
- technicalQuestion
- reportBug
- featureRequest
- billing
- report
*/

export type SupportPostData = {
  title: SupportQuestionType;
  fields: SupportQuestionField[];
  user: User;
  attachments?: Attachment[];
  tag?: string;
};

type LocalSupportPostData = SupportPostData & {
  title: Omit<SupportQuestionType, "bugReport">;
};

async function run(ctx: ButtonInteraction) {
  const { firstParam } = parseCustomId(ctx.customId);

  const cooldownTS = supportPostCooldown.get(ctx.user.id);

  if (
    ["generalQuestion", "technicalQuestion", "reportBug"].includes(
      firstParam
    ) &&
    cooldownTS
  ) {
    await ctx.reply({
      content: `### You have to wait a bit before you can create a new post!\n> Try again <t:${cooldownTS}:R>.`,
      ephemeral: true,
    });
    return;
  }

  switch (firstParam) {
    case "generalQuestion":
      await processGeneralQuestion(ctx);
      break;
    case "technicalQuestion":
      await processTechnicalQuestion(ctx);
      break;
    case "reportBug":
      await processReportBug(ctx);
      break;
    case "featureRequest":
      await ctx.reply({
        embeds: [
          {
            title: "You are wrong here!",
            description: `This is not the place to request features. Please go to <#${featureRequestChannel}> to request a feature.`,
            color: Colors.Red,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "Take me there!",
                url: `https://discord.com/channels/${ctx.guildId}/${featureRequestChannel}`,
              },
            ],
          },
        ],
        ephemeral: true,
      });
      break;
    case "billing":
      await ctx.reply({
        embeds: [
          {
            title:
              "Whoupsi! This isn't the right place to ask billing-related questions!",
            description: [
              "If you would like to request a refund or if your request contains personal information, please send an email to [contact@supportmail.dev](<mailto:contact@supportmail.dev>).",
              "-# We can't help you with billing-related questions here because of privacy reasons.",
              "",
              "If your billing-related inquiry does not contain any of this personal information, please create a ticket by sending a message to <@1082707872565182614>.",
            ].join("\n"),
            color: Colors.Red,
          },
        ],
        ephemeral: true,
      });
      break;
    case "report":
      await ctx.reply({
        embeds: [
          {
            title: "You are wrong here!",
            description:
              "This is not the place to report users. Please use the context commands or slash-commands to report a user.",
            color: Colors.Red,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "Read the Docs",
                url: "https://docs.supportmail.dev/f/reports#how-to-report-someone-or-some-message",
              },
            ],
          },
        ],
        ephemeral: true,
      });
      break;
    default:
      await ctx.reply({
        content: "This component is not yet implemented.",
        ephemeral: true,
      });
      break;
  }
  return;
}

async function processGeneralQuestion(ctx: ButtonInteraction) {
  await ctx.showModal(
    new ModalBuilder()
      .setTitle("General Question")
      .setCustomId("~/generalQuestion")
      .setComponents(
        new ActionRowBuilder<TextInputBuilder>().setComponents(
          new TextInputBuilder({
            label: "Question",
            placeholder: "What is your question?",
            required: true,
            customId: "question",
            minLength: 10,
            maxLength: 2800,
            style: 2,
          })
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder({
            label: "Documentation Links",
            placeholder:
              "Link to articles of the documentation you read - Accessable at docs.supportmail.dev",
            required: true,
            customId: "documentation",
            minLength: 1,
            maxLength: 1250,
            style: 2,
          })
        )
      )
  );

  let finalCtx: ModalMessageModalSubmitInteraction;
  try {
    finalCtx = (await ctx.awaitModalSubmit({
      time: 900_000,
      filter: (interaction) =>
        interaction.customId === "~/generalQuestion" &&
        interaction.user.id === ctx.user.id,
    })) as ModalMessageModalSubmitInteraction;
  } catch {
    return;
  }

  const question = finalCtx.fields.getTextInputValue("question");
  const documentation = finalCtx.fields.getTextInputValue("documentation");

  await ctx.deferReply({ ephemeral: true });

  await createSupportPost(finalCtx, {
    title: "generalQuestion",
    user: ctx.user,
    fields: [
      { title: "question", content: question },
      { title: "documentation-links", content: documentation },
    ],
  });

  supportPostCooldown.set(ctx.user.id);
}

// @ts-ignore
async function processTechnicalQuestion(ctx: ButtonInteraction) {
  // Nearly the same as processGeneralQuestion
}

function processReportBug(ctx: ButtonInteraction) {
  if (ctx.customId.endsWith("cancel")) {
    return ctx.message.delete(); // This can only be in a DM, so we can delete the message
  }

  // REALLY complex, so this is handled by the bugReportHandler file in the utils dir
  return bugReportHandler(ctx);
}

async function createSupportPost(
  ctx: ModalMessageModalSubmitInteraction,
  data: LocalSupportPostData
) {
  data.tag = data.title; // For now, the tag is the same as the title - this might change in the future.
  const channel = (await ctx.guild.channels.fetch(
    supportForumId
  )) as ForumChannel;

  const postContent = getPostContent(data);
  const embeds = getEmbeds(data);

  const post = await channel.threads.create({
    name: data.title,
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    appliedTags: [data.tag, supportTags.unsolved],
    rateLimitPerUser: 2,
    message: {
      content: postContent,
      embeds: embeds,
      files: data.attachments,
      allowedMentions: { users: [data.user.id], repliedUser: false },
    },
  });

  const otherQuestions = await SupportQuestion.find({
    userId: ctx.user.id,
    updatedAt: { $gte: dayjs().subtract(7, "days").toDate() },
  });

  await SupportQuestion.create({
    topic: data.tag,
    userId: data.user.id,
    fields: data.fields,
    postId: post.id,
  });

  if (!["bugReport", "error"].includes(data.title))
    await post.send({
      content:
        data.title == "error"
          ? ""
          : getInstructionsMessage(ctx.guildId, otherQuestions),
      allowedMentions: { repliedUser: false, parse: [] },
      reply: { messageReference: post.id }, // The starter message has the same ID as the post...
    });

  await ctx.editReply({
    content: `Your question has been posted in <#${supportForumId}>.`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "View your Post",
            url: getThreadUrl(ctx.guildId, post.id),
          },
        ],
      },
    ],
  });
}

function getPostContent(data: LocalSupportPostData): string {
  return `## ${SupportQuestionTypeMap[data.title]} | <@${data.user.id}>`;
}

function getEmbeds(data: LocalSupportPostData): EmbedBuilder[] {
  return data.fields.map((field) =>
    new EmbedBuilder()
      .setTitle(SupportQuestionLabelMap[field.title])
      .setDescription(field.content)
      .setColor(Colors.Navy)
      .setImage("https://i.ibb.co/sgGD4TC/invBar.png")
  );
}

function getInstructionsMessage(
  guildid: string, // This needs to be because there is not guildId if the button is clicked in a DM (which is the case for bug reports)
  olderQuestions: HydratedDocument<SupportQuestion>[],
  allowEdit = true
) {
  let content = [
    "### Other question by you in the last 7 days:",
    ...olderQuestions.map(
      (q) =>
        `[${SupportQuestionTypeMap[q._type]}](${getThreadUrl(
          guildid,
          q.postId
        )}) <t:${dayjs(q.createdAt).unix().toFixed()}:R>`
    ),
  ];
  if (allowEdit) {
    content.unshift(
      "-# Right click this message > `Apps` > `Edit Question` to edit it."
    );
  }
  return content.join("\n");
}

export function getThreadUrl(guildid: string, postid: string): string {
  return `https://discord.com/channels/${guildid}/${supportForumId}/${postid}`;
}

export default {
  prefix: PREFIX,
  run,
};
