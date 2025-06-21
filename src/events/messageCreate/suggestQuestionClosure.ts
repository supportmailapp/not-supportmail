import { ChannelType, Message } from "discord.js";
import { SupportPost } from "../../models/supportPost.js";
import NodeCache from "node-cache";

// We don't want to query the database all the time
const authorCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  errorOnMissing: false,
});

export default async function (message: Message) {
  if (
    message.author.bot ||
    message.channel.type !== ChannelType.PublicThread ||
    message.channel.parentId !== process.env.CHANNEL_SUPPORT_FORUM ||
    !shouldSendMessage(message.content)
  ) {
    return;
  }

  let authorId = authorCache.get<string>(message.channelId);

  if (!authorId) {
    const supportPost = await SupportPost.findOne({
      postId: message.channelId,
      closedAt: null,
    });
    if (!supportPost) return;

    authorCache.set(message.channelId, supportPost.author);
    authorId = supportPost.author;
  }

  if (message.author.id !== authorId) return;

  const solvedCommand = message.client.application.commands.cache.find(
    (command) => command.name === "question"
  );
  // * You can add a custom emoji if you want
  const reply = `-# > Is your question solved? If so, you can use </question solve:${solvedCommand?.id}> to close this post.`;

  await message.reply({
    content: reply,
    allowedMentions: { parse: [] },
  });
}

const gratitudeKeywords = [
  "thank you",
  "thanks",
  "thank u",
  "ty",
  "appreciated",
  "helped a lot",
  "great help",
  "that's helpful",
  "thanks for the help",
  "thank you for your help",
];
const questionAnsweredKeywords = [
  "solved",
  "answered",
  "it worked",
  "that's it",
  "got it",
  "makes sense",
  "understood",
  "problem solved",
  "issue resolved",
  "no more questions",
];

function shouldSendMessage(messageContent: string): boolean {
  const lowerCaseMessage = messageContent.toLowerCase();

  const expressesGratitude = gratitudeKeywords.some((keyword) =>
    lowerCaseMessage.includes(keyword)
  );
  const questionIsAnswered = questionAnsweredKeywords.some((keyword) =>
    lowerCaseMessage.includes(keyword)
  );

  return expressesGratitude || questionIsAnswered;
}
