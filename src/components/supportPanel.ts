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
import NodeCache from "node-cache";
import dayjs from "dayjs";
import { SupportQuestion } from "../models/supportQuestion.js";

const { featureRequestChannel, supportForumId, supportTags } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

const topicNames = {
  generalQuestion: "General Question",
  technicalQuestion: "Technical Question",
  reportBug: "Bug Report",
  error: "An Error Occured",
};

const PREFIX = "supportPanel";

// { userid: string (unix timestamp) }
let cooldownCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  errorOnMissing: false,
});

/*
Available component parameters:

- generalQuestion
- technicalQuestion
- reportBug
- featureRequest
- billing
- report
*/

async function run(ctx: ButtonInteraction) {
  const { firstParam } = parseCustomId(ctx.customId);

  const cooldownTS = cooldownCache.get(ctx.user.id);

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
            maxLength: 2048,
            style: 2,
          })
        ),
        new ActionRowBuilder<TextInputBuilder>().setComponents(
          new TextInputBuilder({
            label: "Question topic",
            placeholder: "What is the general topic of your question?",
            required: false,
            customId: "topic",
            minLength: 2,
            maxLength: 100,
            style: 1,
          })
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder({
            label: "Documentation Links",
            placeholder:
              "Link to articles of the documentation you read.\nAccessable at docs.supportmail.dev",
            required: false,
            customId: "documentation",
            minLength: 0,
            maxLength: 2048,
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
  const topic = finalCtx.fields.getTextInputValue("topic");
  const documentation = finalCtx.fields.getTextInputValue("documentation");

  await ctx.deferReply({ ephemeral: true });

  await createSupportPost(finalCtx, {
    title: topic || "General Question",
    user: ctx.user,
    tag: "generalQuestion",
    fields: [
      {
        title: "Question",
        content: question,
      },
      {
        title: "Provided Documentation Links",
        content: documentation || "/",
      },
    ],
  });

  setCooldown(ctx.user.id);
}

async function processTechnicalQuestion(ctx: ButtonInteraction) {
  // Do something
}

async function processReportBug(ctx: ButtonInteraction) {
  // Do something
}

function setCooldown(userid: string) {
  cooldownCache.set(userid, dayjs().add(5, "minutes").unix().toFixed());
}

interface SupportPostData {
  title: string;
  fields: { title: string; content: string }[];
  user: User;
  tag: keyof typeof supportTags;
  attachments?: Attachment[];
}

async function createSupportPost(
  ctx: ModalMessageModalSubmitInteraction,
  data: SupportPostData
) {
  const channel = (await ctx.guild.channels.fetch(
    supportForumId
  )) as ForumChannel;

  const otherQuestions = await SupportQuestion.find({
    userId: ctx.user.id,
    updatedAt: { $gte: dayjs().subtract(7, "days").toDate() },
  });

  const postContent = getPostContent(ctx, data, otherQuestions);
  const embeds = getEmbeds(data);

  const post = await channel.threads.create({
    name: data.title,
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    appliedTags: [data.tag, supportTags.unsolved],
    rateLimitPerUser: 5,
    message: {
      content: postContent,
      embeds: embeds,
      files: data.attachments,
      allowedMentions: { users: [data.user.id], repliedUser: false },
    },
  });

  await SupportQuestion.create({
    topic: data.tag,
    userId: data.user.id,
    fields: data.fields,
    postId: post.id,
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
            label: "View Post",
            url: getThreadUrl(ctx.guildId, post.id),
          },
        ],
      },
    ],
  });
}

function getPostContent(
  ctx: ModalMessageModalSubmitInteraction,
  data: SupportPostData,
  otherQuestions: SupportQuestion[]
): string {
  const baseContent = [
    `# ${topicNames[data.tag]} | <@${data.user.id}>`,
    "-# Right click this message > `Apps` > `Edit Question` to edit it.",
  ];

  if (otherQuestions.length > 0) {
    baseContent.push(
      "",
      "### Other questions in the last 7 days:",
      ...otherQuestions.map(
        (q) =>
          `[${q.topic}](${getThreadUrl(ctx.guildId, q.postId)}) <t:${dayjs(
            q.createdAt
          )
            .unix()
            .toFixed()}:R>`
      )
    );
  }

  return baseContent.join("\n").trim();
}

function getEmbeds(data: SupportPostData): EmbedBuilder[] {
  return data.fields.map((field) =>
    new EmbedBuilder()
      .setTitle(field.title)
      .setDescription(field.content)
      .setColor(Colors.Navy)
      .setImage("https://i.ibb.co/sgGD4TC/invBar.png")
  );
}

function getThreadUrl(guildid: string, postid: string): string {
  return `https://discord.com/channels/${guildid}/${supportForumId}/${postid}`;
}

export default {
  prefix: PREFIX,
  run,
};
