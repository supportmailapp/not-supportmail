/**
This file exists to handle the complex process of collecting and processing bug reports from users.

- Multi-step process for gathering detailed information about bugs reported by users. It guides the user through several stages of providing information, including describing the bug, steps to reproduce, expected results, actual results, attempts to fix the bug, related server IDs, and attachments.

It manages user interactions through a private thread.

Includes mechanisms for handling timeouts, maximum message limits, and unknown errors.

Once all necessary information is collected, it prepares and submits the final bug report to the appropriate channel in the support forum.
*/

import dayjs from "dayjs";
import {
  ActionRowBuilder,
  Attachment,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ChannelType,
  Colors,
  EmbedBuilder,
  ForumChannel,
  Message,
  MessageCreateOptions,
  PrivateThreadChannel,
  TextChannel,
  ThreadAutoArchiveDuration,
  User,
} from "discord.js";
import bugReportsCache from "../../caches/bugReportsCache.js";
import supportPostCooldown from "../../caches/supportPostCooldown.js";
import {
  BugReportTitle,
  SupportQuestion,
  SupportQuestionLabelMap,
  SupportQuestionTypeMap,
} from "../../models/supportQuestion.js";
import { getThreadUrl, SupportPostData } from "../supportPanel.js";
import { delay } from "../../utils/main.js";

const { supportForumId, supportTags } = (
  await import("../../../config.json", {
    with: { type: "json" },
  })
).default;

/*
When the button is clicked, a private thread is created and the user will get pinged where the process starts.

- Describe the bug (not the steps to reproduce)
- Steps to reproduce the bug
- Expected result
- Actual result
- What you tried to fix the bug and if it worked
- Server IDs related to this bug (if any)
- Screenshots or videos (if any + not stored in DB)

If want to leave tried to fix or serverids blank, just type `-skip` and it will be skipped.
*/

function cancelProcessButton(withRow: false): ButtonBuilder;
function cancelProcessButton(withRow: true): ActionRowBuilder<ButtonBuilder>;
function cancelProcessButton(withRow: boolean = false) {
  const button = new ButtonBuilder({
    customId: "supportPanel?bugReport/cancel",
    label: "Cancel",
    style: 4,
    emoji: {
      name: "whiteX",
      id: "1304165548447240222",
    },
  });
  if (withRow)
    return new ActionRowBuilder<ButtonBuilder>().setComponents(button);
  return button;
}

const TIME_TO_ANSWER = 900_000; // ms

/**
 * ### Usage:
 *
 * ```js
 * { ...getFooterMessage() }
 * ```
 */
function getBaseMessage() {
  return {
    author: {
      name: "Bug Report",
    },
    color: Colors.Blurple,
  };
}

type PartialBugData = Partial<Record<BugReportTitle, string>> & {
  attachments: Attachment[];
};

export default async function bugReportHandler(ctx: ButtonInteraction) {
  await ctx.deferReply({ ephemeral: true });
  const user = ctx.user;

  const currentThreadUrl = bugReportsCache.getCurrentProcess(user.id);
  if (currentThreadUrl) {
    await ctx.editReply({
      content:
        "# :x: You already have an ongoing bug report process.\n- Please `finish` this first or `cancel` it.",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Take me there!",
              url: currentThreadUrl,
            },
          ],
        },
      ],
    });
    return;
  }

  const thread = (await (ctx.channel as TextChannel).threads.create({
    name: "Bug Report | " + dayjs().format("YYYY-MM-DD HH:mm:ss"),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: `Bug report process started by ${user.tag}`,
  })) as PrivateThreadChannel;

  await thread.send({
    content:
      `-# <@${user.id}>\n` +
      "## Please answer the following questions to report a bug.",
    embeds: [
      {
        title: "Bug Description",
        description:
          "Describe the bug.\n" +
          "- :warning: No attachments please. You will have the option later.\n" +
          "- :warning: **Not** the steps to reproduce - just the bug itself.",
        footer: {
          text: "You have 15 minutes to answer each question. If you don't answer in time, the process will be cancelled.",
        },
        ...getBaseMessage(),
      },
    ],
    components: [cancelProcessButton(true)],
  });
  await thread.members.add(user.id);

  await ctx.editReply({
    content: "# Head over to the thread to and follow my instructions there.",
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Take me there!",
            url: thread.url,
          },
        ],
      },
    ],
  });

  function filterMessage(channelId: string, userId: string) {
    return (msg: Message) =>
      msg.channelId === channelId &&
      msg.author.id === userId &&
      msg.channel.type === ChannelType.PrivateThread;
  }

  let bugData: PartialBugData = { attachments: [] };

  let answerState = 1; // 1: description, 2 steps, 3: expected, 4: actual, 5: triedToFix, 6: serverIds, 7: attachments

  async function unknownError(thread: PrivateThreadChannel) {
    await thread.send(
      ":x: Process cancelled due to an unknown error.\n" +
        "-# This thread will not be deleted to investigate the issue. 🚨 **Don't delete your messages please!**\n\n" +
        "<@&1109802053938712686>"
    );
    await thread.setLocked(true);
  }

  try {
    await new Promise((resolve, reject) => {
      const collector = thread.createMessageCollector({
        filter: filterMessage(thread.id, user.id),
        idle: TIME_TO_ANSWER,
      });

      collector.on("collect", async (msg) => {
        let isValid = msg.content.length > 0;
        let replyEmbed = new EmbedBuilder({ ...getBaseMessage() });
        switch (answerState) {
          case 1: {
            bugData["bug-description"] = msg.content;
            replyEmbed.setTitle("Steps to reproduce the bug");
            replyEmbed.setDescription(
              "Please provide the steps to reproduce the bug."
            );
            replyEmbed.addFields([
              {
                name: "Template",
                value: "```" + "1. Step 1\n2. Step 2\n3. Step 3" + "```",
                inline: false,
              },
              {
                name: "Example",
                value:
                  "```\n" +
                  "1. Send a message to the bot\n" +
                  '2. Click on the "Create Ticket" button\n' +
                  "3. Wait for the bot to respond with something\n" +
                  "```",
                inline: false,
              },
            ]);
            await ctx.deleteReply();
            break;
          }
          case 2: {
            bugData.steps = msg.content;
            replyEmbed.setTitle("Expected Result");
            replyEmbed.setDescription("What did you expect to happen?");
            break;
          }
          case 3: {
            bugData.expected = msg.content;
            replyEmbed.setTitle("Actual Result");
            replyEmbed.setDescription("What actually happened?");
            break;
          }
          case 4: {
            bugData.actual = msg.content;
            replyEmbed.setTitle(
              "What did you try to fix the bug? Did it work?"
            );
            replyEmbed.setDescription(
              "If you tried to fix the bug, please describe what you tried and if it worked.\n" +
                "-# If you didn't try anything yet, please type `-skip`."
            );
            break;
          }
          case 5: {
            bugData.tried = msg.content;
            replyEmbed.setTitle("Server IDs related to this bug");
            replyEmbed.setDescription(
              "If the bug is related to a specific server, please provide the server ID.\n" +
                "If the error happens in a DM, write `-dm`.\n" +
                "-# If the bug is not server-specific, please type `-skip`.\n\n" +
                "Visit this page if you don't know how to get a server or channel ID: [How to get an ID](https://docs.supportmail.dev/e/get-ids#channel-id)"
            );
            break;
          }
          case 6: {
            if (msg.content === "-skip") {
              bugData.serverids = null;
            } else if (msg.content === "-dm") {
              bugData.serverids = "None (DM)";
            }
            replyEmbed.setTitle("Attachments");
            replyEmbed.setDescription(
              "**If you have any attachments, please send them here.**\n\n" +
                "Please type `-done` when you are finished.\n" +
                "-# If you don't have any attachments, please type `-skip`.\n" +
                "> :x: **Anything else than Images and Videos will not be processed.**"
            );
            break;
          }
          case 7: {
            if (["-skip", "-done"].includes(msg.content)) {
              if (msg.content === "-skip") bugData.attachments = [];
              await msg.react("✅");
              collector.stop("done");
              return;
            }

            if (msg.attachments.size === 0) {
              isValid = false;
              break;
            }

            const parsedAttachments =
              msg.attachments
                .filter(
                  (a) =>
                    a.contentType.startsWith("image") ||
                    a.contentType.startsWith("video")
                )
                ?.map((a) => a) || [];

            if (parsedAttachments?.length > 0) {
              bugData.attachments.push(...parsedAttachments);
            } else {
              isValid = false;
            }

            break;
          }
        }

        if (isValid) {
          await msg.react("✅");
          await thread.send({
            embeds: [replyEmbed],
          });
        } else {
          await msg.react("❌");
        }

        if (answerState >= 7) {
          collector.stop("done");
          return;
        }

        answerState++;
      });

      collector.once("end", (collection, reason) => {
        if (reason == "idle" || reason == "processedLimit") {
          reject(reason);
        } else if ("done" === reason) {
          resolve(collection); // ? Is that correct?
        } else {
          reject("unknown");
        }
      });
    });
  } catch (error) {
    if (error == "idle") {
      await handleTimeout(thread, user.id);
    } else if (error == "processedLimit") {
      await handleMaxMessages(thread, user);
    } else {
      // 1109802053938712686 = Bot Dev Role
      await unknownError(thread);
    }
    return;
  }

  const response = await handleFinish(thread, user, bugData);
  let interaction: ButtonInteraction;
  let finished = false;
  try {
    interaction = await response.awaitMessageComponent({
      filter: (_i) => _i.user.id === user.id,
      time: 300_000,
      componentType: 2,
    });
    finished = true;
  } catch (error) {
    if (error !== "time") {
      await unknownError(thread);
    }
  }

  if (finished && interaction.customId === "~/cancel") {
    await handleCancel(interaction, thread);
    return;
  }
  // finished === false && interaction.customId === "~/submit"
  await handleSubmit(interaction, thread, bugData);
  return;
}

export async function handleCancel(
  ctx: ButtonInteraction,
  thread: PrivateThreadChannel
) {
  bugReportsCache.deleteProcess(ctx.user.id);

  // There could be issues if we delete the channel right away - so we delete the message first
  await ctx.message.delete().catch(() => null);
  await thread.delete(`User (${ctx.user.id}) cancelled the bug process.`);
}

export async function handleTimeout(
  thread: PrivateThreadChannel,
  user: string
) {
  bugReportsCache.deleteProcess(user);
  await thread.send(
    ":x: **Process cancelled due to inactivity.**\n-# This thread will be deleted in 10 seconds."
  );
  await delay(10_000);
  await thread.delete(`User (${user}) didn't respond in time.`);
  return;
}

export async function handleMaxMessages(
  thread: PrivateThreadChannel,
  user: User
) {
  bugReportsCache.deleteProcess(user.id);
  await thread.send(
    ":x: **You tried to hard to report a bug.** Please create a new bug report if you really want to report a bug." +
      "\n-# This thread will be deleted in 10 seconds."
  );
  await delay(10_000);
  await thread.delete(`User (${user.username} | ${user.id}) tried too hard.`);
  return;
}

export async function handleFinish(
  thread: PrivateThreadChannel,
  user: User,
  bugData: PartialBugData
) {
  bugReportsCache.deleteProcess(user.id);

  // Markdown file with the information because of Discord-Limits
  const MDHeader = `# Bug Report | ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`;
  const MDFields = Object.entries(bugData)
    .filter(([key]) => key !== "attachments")
    .map(
      ([k, v]: [string, string]) =>
        `## ${SupportQuestionLabelMap[k]}\n${v || "/"}\n`
    )
    .join("\n\n");
  const attachmentsMd =
    bugData.attachments?.length > 0
      ? "## Attachments\n" +
        bugData.attachments.map((a) => `- ${a.url}`).join("\n")
      : null;

  const informationFile = new AttachmentBuilder(
    Buffer.from(
      [MDHeader, MDFields, attachmentsMd]
        .filter((x) => x.length > 0 || Boolean(x))
        .join("\n\n")
    ),
    {
      name: `bug-report-${dayjs().unix()}.md`,
    }
  );

  return thread.send({
    content:
      "# Thank your for reporting this issue!\n" +
      "Here is the information you provided. Please review it and click the button to submit the report.\n**Please note that:**" +
      "- Because of Discord-Limits I had to send this to you as a file.\n" +
      "- If you want to make changes, you need to cancel and start again.\n" +
      "- You can't edit the report after submitting it.\n\n" +
      "### If you don't do anything, the bug report will created automatically in 5 minutes.",
    files: [informationFile],
    components: [
      new ActionRowBuilder<ButtonBuilder>().setComponents(
        cancelProcessButton(false).setCustomId("~/cancel"),
        new ButtonBuilder({
          customId: "~/submit",
          label: "Submit Report",
          style: 3,
          emoji: {
            name: "whiteCheck",
            id: "1304487881636839485",
          },
        })
      ),
    ],
  });
}

function generateEmbeds(data: Partial<SupportPostData>) {
  return {
    embeds: data.fields.map((field) =>
      new EmbedBuilder()
        .setTitle(SupportQuestionLabelMap[field.title])
        .setDescription(field.content || "/")
        .setColor(Colors.Navy)
        .setImage("https://i.ibb.co/sgGD4TC/invBar.png")
    ),
    charCounts: data.fields.map(
      (f) => (f.content || "/").length + SupportQuestionLabelMap[f.title].length
    ),
  };
}

export async function handleSubmit(
  btnCtx: ButtonInteraction,
  thread: PrivateThreadChannel,
  bugData: PartialBugData
) {
  let data: Partial<SupportPostData> = {
    tag: "bugReport",
    title: "bugReport",
    user: btnCtx.user,
    fields: Object.entries(bugData)
      .filter(([key]) => key != "attachments")
      .map(([k, v]: [BugReportTitle, string]) => ({
        title: k,
        content: v || null,
      })),
  };
  const supportForum = (await btnCtx.guild.channels.fetch(
    supportForumId
  )) as ForumChannel;

  const postContent = `## ${SupportQuestionTypeMap[data.title]} | <@${
    btnCtx.user.id
  }>`;
  const { embeds, charCounts } = generateEmbeds(data);

  // Since the max char count on a embed.description is 4096, we need to split the messages
  let messages: MessageCreateOptions[] = [];

  const getDefaultPreviousData = () => ({ count: 0, embeds: [] });
  let previousData = getDefaultPreviousData();
  const maxCharCount = 6000;

  for (let i = 0; i < embeds.length; i++) {
    if (previousData.count + charCounts[i] <= maxCharCount) {
      previousData.count += charCounts[i];
      previousData.embeds.push(embeds[i]);
      if (i < embeds.length - 1) continue; // To prevent the last message to be skipped
    }

    messages.push({
      content: i === 0 ? postContent : "",
      embeds: previousData.embeds,
      files:
        i === 0 && bugData.attachments && bugData.attachments.length > 0
          ? bugData.attachments
          : undefined,
      allowedMentions: { users: [data.user.id] },
    });
    previousData = {
      count: charCounts[i],
      embeds: [embeds[i]],
    };
  }

  const post = await supportForum.threads.create({
    name: SupportQuestionTypeMap[data.title] + ` | ${btnCtx.user.username}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    appliedTags: [supportTags.bugReport, supportTags.unsolved],
    rateLimitPerUser: 2,
    message: messages[0],
  });

  if (messages.length > 1)
    for (const message of messages.slice(1)) {
      await delay(750);
      await post.send(message);
    }

  await SupportQuestion.create({
    _type: "bugReport",
    userId: data.user.id,
    fields: data.fields.map((f) => ({
      title: f.title,
      content: f.content,
    })),
    postId: post.id,
    attachments: bugData.attachments.map((a) => a.url),
    flags: { noAutoClose: true },
  });

  supportPostCooldown.set(btnCtx.user.id);

  await btnCtx.update({ components: [] });

  await btnCtx.followUp({
    content:
      `### Your Bug Report has been posted in <#${supportForumId}>.\n` +
      `> [View your Post](${getThreadUrl(btnCtx.guildId, post.id)})`,
  });
  // No components because you can't even click URL buttons in a locked post >:(

  await thread.setLocked(true);
}
