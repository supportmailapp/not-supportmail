import { MongoBackend } from "@agendajs/mongo-backend";
import { Agenda } from "agenda";
import { voteReminder } from "./jobs/daily";
import { reminderHandler } from "./jobs/reminder";
import type { mongo } from "mongoose";

let agenda: Agenda | null = null;

// Function to initialize agenda after mongoose connects
export async function initializeAgenda(db: mongo.Db) {
  agenda = new Agenda({
    backend: new MongoBackend({ mongo: db }),
    processEvery: 60_000,
    maxConcurrency: 3,
    defaultLockLimit: 0,
    defaultLockLifetime: 60_000,
  });
  agenda.db.connect();

  agenda.define("voteReminder", voteReminder);
  agenda.define<{ postId: string; userId: string }>(
    "postReminder",
    reminderHandler,
  );

  agenda.every("0 8 * * *", "voteReminder");

  await agenda.start();
}

export function getAgenda() {
  if (!agenda) {
    throw new AgendaNotInitializedError();
  }
  return agenda;
}

process.on("SIGINT", async () => {
  console.info("Received SIGINT, shutting down gracefully...");
  await gracefulShutdown();
  process.exit(0);
});

export async function gracefulShutdown() {
  if (agenda) {
    await agenda.stop(false);
    console.info("Agenda scheduler stopped gracefully");
  }
}

export class AgendaNotInitializedError extends Error {
  constructor() {
    super("Agenda has not been initialized yet.");
    this.name = "AgendaNotInitializedError";
  }
}
