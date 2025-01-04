import { scheduleJob } from "node-schedule";
import { BotVote } from "../models/botVote.js";
import dayjs from "dayjs";
import { REST, Routes } from "discord.js";
import config from "../config.js";

export class VoteSyncScheduler {
  public static rest = new REST().setToken(config.botToken);

  public static async start() {
    scheduleJob("0 * * * *", async () => {
      let votesToRemove = await BotVote.find({
        hasRole: true,
        $and: [
          { removeRoleBy: { $exists: true } },
          { removeRoleBy: { $lte: dayjs().toDate() } },
        ],
      });

      if (votesToRemove.length === 0) return;

      votesToRemove.sort((a, b) => (a.removeRoleBy > b.removeRoleBy ? -1 : 1));
      const uniqueVotes = votesToRemove.reduce((acc, vote) => {
        if (!acc.find((v) => v.userId === vote.userId)) {
          acc.push(vote);
        }
        return acc;
      }, []);

      if (uniqueVotes.length === 0) return;

      for (const vote of uniqueVotes) {
        await this.rest
          .delete(
            Routes.guildMemberRole(
              config.guildId,
              vote.userId,
              config.voteRoleId
            )
          )
          .catch((e) => console.error(e));
      }

      await BotVote.deleteMany({
        userId: { $in: uniqueVotes.map((v) => v.userId) },
      });
    });

    console.debug("VoteSyncScheduler started");
  }
}
