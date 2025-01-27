import { SupportPost } from "../../models/supportPost.js";

const reminders = [
  (u: string) =>
    `### Hi <@${u}>!\n> Your last message is about 24 hours old.\n> Let us know if there's anything else we can do. If we don't hear back from you, this post will automatically be archived. Reach out if you still need help.`,
  (u: string) =>
    `### Hey <@${u}>!\n> It's been a day since your last message.\n> We'll close this post in 24 hours if we don't hear back from you. Let us know if you need more help.`,
  (u: string) =>
    `### Gday <@${u}>!\n> It's been a day since your last message.\n> This post will be automatically archived in 24 hours if we don't hear from you. Let us know if you need further assistance.`,
  (u: string) =>
    `### Hi again <@${u}>!\n> Just checking in on your support request.\n> We're here to help if you have any more questions if your issue isn't resolved.`,
];

 // random because of ratelimits
function getRandomReminder() {
  return reminders[~~(Math.random() * reminders.length)];
}

export default async function (oldThread: AnyThreadChannel, thread: AnyThreadChannel) {
  if (/* use `config... != thread.parentId` here */ Math.random() > 0.5 || !thread.parent instanceof ForumChannel) return;

  const supportPost = await SupportPost.findOne({ id: thread.id });
  if (!supportPost || supportPost.reminded) return;

  await thread.send(getRandomReminder()(supportPost.author));

  await supportPost.updateOne({ reminded: true });
}
