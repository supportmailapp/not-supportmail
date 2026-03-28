import { Schema, model } from "mongoose";

export interface INotice {
  message: string;
  isActive: boolean;
  resolutionComment?: string;
  /**
   * Key is the thread ID, value is an array of user IDs to notify in that thread when the notice is resolved.
   */
  notifyThreads: Record<string, string[]>;
}

const noticeSchema = new Schema<INotice>({
  message: { type: String, required: true },
  isActive: { type: Boolean, required: true, default: true },
  resolutionComment: { type: String, required: false },
  notifyThreads: { type: Schema.Types.Mixed, default: () => ({}) },
});

export const Notice = model<INotice>("Notice", noticeSchema, "notices");
