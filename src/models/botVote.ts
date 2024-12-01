import { DiscordSnowflake } from "@sapphire/snowflake";
import { HydratedDocument, model, Schema } from "mongoose";
import config from "../config.js";

export interface IBotVote {
  /**
   * Snowflake ID of the vote
   */
  id: BigInt;
  userId: string;
  botId: string;
  synced?: boolean;
}

export type BotVoteDocument = HydratedDocument<IBotVote>;

const botVoteSchema = new Schema<IBotVote>({
  id: { type: Schema.Types.BigInt, default: DiscordSnowflake.generate },
  userId: { type: String, required: true },
  botId: { type: String, default: config.clientId },
  synced: { type: Boolean, default: false },
});

export const BotVote = model<IBotVote>("BotVote", botVoteSchema, "botVotes");
