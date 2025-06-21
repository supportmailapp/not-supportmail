import { Schema, createConnection } from "mongoose";
import type { IBotVote } from "supportmail-types";

const mainConnection = createConnection(process.env.MONGO_URI_MAIN!);

// Optional: Add basic error handling
mainConnection.on("error", (err) => {
  console.error("Main DB connection error:", err);
});

const botVoteSchema = new Schema<IBotVote>({
  userId: { type: String, required: true },
  botId: { type: String, default: process.env.CLIENT_ID },
  hasRole: { type: Boolean, default: false },
  removeRoleBy: { type: Date, required: false },
});

export const BotVote = mainConnection.model<IBotVote>(
  "BotVote",
  botVoteSchema,
  "botVotes"
);
