import dayjs from "dayjs";
import schedule from "node-schedule";
import { SupportQuestion } from "../models/supportQuestion.js";
import {
  APIApplicationCommand,
  REST,
  Routes,
  ThreadEditOptions,
} from "discord.js";
const { botToken } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

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

const closeWithCommandText = (commands: APIApplicationCommand[]) =>
  `If your question was answered, please resolve it with the command </resolve:${
    commands.find((cmd) => cmd.name == "resolve").id
  }>.`;

class ClosePostsScheduler {
  public static async start() {
    schedule.scheduleJob("* *1 * * *", this.execute);
  }

  // random because of ratelimits
  private static getRandomReminderMessage() {
    return reminders[~~(Math.random() * reminders.length)];
  }

  public static async execute() {
    const nowTs = dayjs();

    const inactivePosts = await SupportQuestion.find({
      $and: [{ closedAt: { $ne: null } }, { resolved: false }],
      lastActivity: { $gte: nowTs.subtract(2, "days").toDate() },
      $or: [
        { "flags.noAutoClose": { $exists: false } },
        { "flags.noAutoClose": false },
      ],
    });

    if (inactivePosts.length == 0) return;

    const rest = new REST({ version: "10" }).setToken(botToken);

    const toRemind = inactivePosts.filter((p) => p.flags.reminded != true);
    const toArchive = inactivePosts.filter(
      (p) =>
        p.flags.reminded == true &&
        p.updatedAt <= nowTs.subtract(2, "days").toDate()
    );
    const appCommands = (await rest.get(
      Routes.applicationCommands("1097562026575933604")
    )) as APIApplicationCommand[];
    const closeWithCommand = "\n-# " + closeWithCommandText(appCommands);

    for (const post of toRemind) {
      await rest.post(Routes.channelMessages(post.postId), {
        body: {
          content:
            this.getRandomReminderMessage()(post.userId) + closeWithCommand,
          allowed_mentions: { users: [post.userId] },
        },
      });
    }

    await SupportQuestion.updateMany(
      { _id: { $in: toRemind.map((p) => p._id) } },
      { "flags.toArchive": true }
    );

    for (const post of toArchive) {
      await rest.patch(Routes.channel(post.postId), {
        body: {
          archived: true,
        } as ThreadEditOptions,
        reason: "Inactive",
      });
    }

    await SupportQuestion.updateMany(
      { _id: { $in: toArchive.map((p) => p._id) } },
      { closedAt: dayjs().toDate() }
    );
  }
}

export default ClosePostsScheduler;
