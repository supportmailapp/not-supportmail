import schedule from "node-schedule";
import { client } from "../index.js";
import * as Sentry from "@sentry/node";
import { voteMessage } from "../utils/main.js";

// Daily, at UTC+1 09:00

schedule.scheduleJob("0 8 * * *", async function dailyCron() {
  const channel = await client.channels.fetch("1109806977296642118"); // bot commands channel
  if (!channel?.isSendable()) {
    Sentry.captureMessage("Daily Cron: Channel not found or not sendable");
    return;
  }

  await channel.send(voteMessage).catch((err) =>
    Sentry.captureException(err, {
      level: "error",
      extra: { context: "Daily Cron: Sending vote message failed" },
    })
  );
});
