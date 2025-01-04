import { HydratedDocument, model, Schema } from "mongoose";
import config from "../config.js";

export interface IBotVote {
  userId: string;
  botId: string;
  /**
   * Whether the user has the vote role
   *
   *
   */
  hasRole: boolean;
  /**
   * Whether the user has the vote role | Only given, when role was successfully applied
   *
   * @default false
   */
  removeRoleBy?: Date | undefined;
}

export type BotVoteDocument = HydratedDocument<IBotVote>;

const botVoteSchema = new Schema<IBotVote>({
  userId: { type: String, required: true },
  botId: { type: String, default: config.clientId },
  hasRole: { type: Boolean, default: false },
  removeRoleBy: { type: Date, required: false },
});

export const BotVote = model<IBotVote>(
  "BotVote",
  botVoteSchema,
  "botVotes"
);
