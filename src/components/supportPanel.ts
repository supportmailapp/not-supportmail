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

import dayjs from "dayjs";
import { HydratedDocument } from "mongoose";
import supportPostCooldown from "../caches/supportPostCooldown.js";
import {
  ISupportQuestion,
  SupportQuestion,
  SupportQuestionField,
  SupportQuestionLabelMap,
  SupportQuestionType,
  SupportQuestionTypeMap,
} from "../models/supportQuestion.js";
import { parseCustomId } from "../utils/main.js";
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

async function run(
  ctx: ButtonInteraction | ModalMessageModalSubmitInteraction
) {
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
    case "error":
      await processErrorQuestion(ctx);
      break;
    case "reportBug":
      await processReportBug(ctx as ButtonInteraction);
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
              "If you would like to request a refund or if your request contains personal information, please send an email to `contact@supportmail.dev`.",
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
              "This is not the place to report users. Please use the context commands or slash-commands to report a user.\n" +
              "## Want to report abuse of the system?\n" +
              "We take abuse of the system very seriously.\n" +
              "However, since the information is not intended for the public, please create a ticket by sending a direct message to <@1082707872565182614> as the information may be sensitive and not intended for the public.",
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

async function processGeneralQuestion(
  ctx: ButtonInteraction | ModalMessageModalSubmitInteraction
) {
  if (ctx.isButton()) {
    await ctx.showModal(
      new ModalBuilder()
        .setTitle("General Question")
        .setCustomId(PREFIX + "?generalQuestion")
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
    return;
  }

  const question = ctx.fields.getTextInputValue("question");
  const documentation = ctx.fields.getTextInputValue("documentation");

  await ctx.deferReply({ ephemeral: true });

  await createSupportPost(ctx, {
    title: "generalQuestion",
    user: ctx.user,
    fields: [
      { title: "question", content: question },
      { title: "documentation-links", content: documentation },
    ],
  });

  supportPostCooldown.set(ctx.user.id);
}

async function processTechnicalQuestion(
  ctx: ButtonInteraction | ModalMessageModalSubmitInteraction
) {
  if (ctx.isButton()) {
    await ctx.showModal(
      new ModalBuilder()
        .setTitle("Technical Question")
        .setCustomId(PREFIX + "?technicalQuestion")
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder({
              label: "Question",
              placeholder: "What is your question?",
              required: true,
              customId: "question",
              minLength: 10,
              maxLength: 2048,
              style: 2,
            })
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder({
              label: "Why are you asking this question?",
              placeholder: "This will help us understand your question better.",
              required: true,
              customId: "whyask",
              minLength: 10,
              maxLength: 2048,
              style: 2,
            })
          )
        )
    );
    return;
  }

  const question = ctx.fields.getTextInputValue("question");
  const whythisquestion = ctx.fields.getTextInputValue("whyask");

  await ctx.deferReply({ ephemeral: true });

  await createSupportPost(ctx, {
    title: "technicalQuestion",
    user: ctx.user,
    fields: [
      { title: "question", content: question },
      { title: "whyask", content: whythisquestion },
    ],
  });

  supportPostCooldown.set(ctx.user.id);
}

async function processErrorQuestion(
  ctx: ButtonInteraction | ModalMessageModalSubmitInteraction
) {
  if (ctx.isButton()) {
    // Nearly the same as the general question, but with more fields
    await ctx.showModal(
      new ModalBuilder()
        .setTitle("Error")
        .setCustomId(PREFIX + "?error")
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder({
              label: "Related Feature",
              placeholder: "What feature is this error related to?",
              required: true,
              customId: "feature",
              minLength: 10,
              maxLength: 2800,
              style: 2,
            })
          ),
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder({
              label: "Error Message",
              placeholder: "What is the error message?",
              required: true,
              customId: "error",
              minLength: 10,
              maxLength: 2800,
              style: 2,
            })
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder({
              label: "Steps to Reproduce",
              placeholder: "How can we reproduce the error?",
              required: true,
              customId: "steps",
              minLength: 10,
              maxLength: 2800,
              style: 2,
            })
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder({
              label: "Expected Result",
              placeholder: "What did you expect to happen?",
              required: true,
              customId: "expected",
              minLength: 10,
              maxLength: 2800,
              style: 2,
            })
          )
        )
    );
    return;
  }

  const relatedFeature = ctx.fields.getTextInputValue("feature");
  const errorMessage = ctx.fields.getTextInputValue("error");
  const steps = ctx.fields.getTextInputValue("steps");
  const expected = ctx.fields.getTextInputValue("expected");

  await ctx.deferReply({ ephemeral: true });

  await createSupportPost(ctx, {
    title: "error",
    user: ctx.user,
    fields: [
      { title: "feature", content: relatedFeature },
      { title: "error", content: errorMessage },
      { title: "steps", content: steps },
      { title: "expected", content: expected },
    ],
  });

  supportPostCooldown.set(ctx.user.id);
}

function processReportBug(ctx: ButtonInteraction) {
  if (ctx.customId.endsWith("cancel")) {
    return ctx.message.delete(); // This can only be in a DM, so we can delete the message
  }

  // REALLY complex, so this is handled by the bugReportHandler file in the utils dir
  return bugReportHandler(ctx);
}

async function createSupportPost(
  modalCtx: ModalMessageModalSubmitInteraction,
  data: LocalSupportPostData
) {
  data.tag = data.title; // For now, the tag is the same as the title - this might change in the future.
  const channel = (await modalCtx.guild.channels.fetch(
    supportForumId
  )) as ForumChannel;

  const postContent = getPostContent(data);
  const embeds = getEmbeds(data);

  const post = await channel.threads.create({
    name: SupportQuestionTypeMap[data.title] + ` | ${modalCtx.user.username}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    appliedTags: [supportTags[data.tag], supportTags.unsolved],
    rateLimitPerUser: 2,
    message: {
      content: postContent,
      embeds: embeds,
      files: data.attachments,
      allowedMentions: { users: [data.user.id], repliedUser: false },
    },
  });

  const otherQuestions = await SupportQuestion.find({
    userId: modalCtx.user.id,
    updatedAt: { $gte: dayjs().subtract(7, "days").toDate() },
  });

  await SupportQuestion.create({
    _type: data.tag,
    userId: data.user.id,
    fields: data.fields,
    postId: post.id,
  });

  if (!["bugReport", "error"].includes(data.title)) {
    const instructions = getInstructionsMessage(
      modalCtx.guildId,
      otherQuestions
    );
    if (instructions.length > 0)
      await post.send({
        content: getInstructionsMessage(modalCtx.guildId, otherQuestions),
        allowedMentions: { repliedUser: false, parse: [] },
        reply: { messageReference: post.id }, // The starter message has the same ID as the post...
      });
  }

  await modalCtx.editReply({
    content: `Your question has been posted in <#${supportForumId}>.`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "View your Post",
            url: getThreadUrl(modalCtx.guildId, post.id),
          },
        ],
      },
    ],
  });
}

function getPostContent(data: LocalSupportPostData): string {
  return `## ${SupportQuestionTypeMap[data.title]} | <@${data.user.id}>`;
}

/**
 * Formats the content (escapes links + hyperlinks) and returns an array of embeds for the support post.
 */
function getEmbeds(data: LocalSupportPostData): EmbedBuilder[] {
  return data.fields.map((field) =>
    new EmbedBuilder()
      .setTitle(SupportQuestionLabelMap[field.title])
      .setDescription(
        field.content
          .replace(
            /\[(?<text>[^]]+)\]\((?<link>https?:\/\/[^)]+)\)\s*/gi,
            (_, text, link) => `${text} (${link})`
          )
          .replace(/(https?:\/\/\S+)\)/gi, (_, link) => `<${link}>`)
      )
      .setColor(Colors.Navy)
      .setImage("https://i.ibb.co/sgGD4TC/invBar.png")
  );
}

function getInstructionsMessage(
  guildid: string, // This needs to be because there is not guildId if the button is clicked in a DM (which is the case for bug reports)
  olderQuestions: HydratedDocument<ISupportQuestion>[],
  // @ts-ignore
  allowEdit = true
) {
  let content = [""];
  if (olderQuestions.length > 0)
    content.push(
      "### Other questions by you in the last 7 days:",
      ...olderQuestions.map(
        (q) =>
          `[${SupportQuestionTypeMap[q._type]}](${getThreadUrl(
            guildid,
            q.postId
          )}) <t:${dayjs(q.createdAt).unix().toFixed()}:R>`
      )
    );
  // if (allowEdit) {
  //   content.unshift(
  //     "-# Right click this message > `Apps` > `Edit Question` to edit it."
  //   );
  // }
  return content.join("\n").trim();
}

export function getThreadUrl(guildid: string, postid: string): string {
  return `https://discord.com/channels/${guildid}/${postid}`;
}

export default {
  prefix: PREFIX,
  run,
};
