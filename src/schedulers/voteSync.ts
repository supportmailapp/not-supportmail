import { scheduleJob } from "node-schedule";
import { BotVote } from "../models/botVote.js";
import { DiscordSnowflake } from "@sapphire/snowflake";
import dayjs from "dayjs";
import { REST, Routes } from "discord.js";
import config from "../config.js";

export class VoteSyncScheduler {
  public static async start() {
    scheduleJob("0 * * * *", async () => {
      let snowflake = DiscordSnowflake.generate({
        timestamp: dayjs().subtract(2, "days").toDate(),
      });
      let votesToRemove = await BotVote.find({
        id: { $lte: snowflake },
      });

      const rest = new REST().setToken(config.botToken);

      for (const vote of votesToRemove) {
        await rest
          .delete(
            Routes.guildMemberRole(
              config.guildId,
              vote.userId,
              config.voteRoleId
            )
          )
          .catch((e) => console.error(e));
      }
    });
    console.debug("VoteSyncScheduler started");
  }
}
