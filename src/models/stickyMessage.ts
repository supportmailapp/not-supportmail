import { model, Schema } from "mongoose";

export interface DBStickyMessage {
  channelId: string;
  messageId: string;
}

export const StickyMessageSchema = new Schema<DBStickyMessage>({
  channelId: { type: String, required: true, unique: true },
  messageId: { type: String, required: true },
});

export const DBStickyMessage = model<DBStickyMessage>(
  "StickyMessage",
  StickyMessageSchema,
  "stickyMessages"
);
