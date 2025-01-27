import dayjs from "dayjs";
import { model, Schema } from "mongoose";

export interface SupportPostIgnoreFlags {
  /**
   * If `true` then no reminder should be sent.
   */
  reminder?: boolean;
  /**
   * If `true` then automatic close ("resolved" tag + archive) should not happen.
   */
  close?: boolean;
}

export interface SupportPostFlags {
  /**
   * If `true` then the post gets unarchived when it archives automatically.
   */
  noArchive?: boolean;
}

export interface ISupportPost {
  id: string;
  author: string;
  postId: string;
  remindedAt: Date | null;
  ignoreFlags?: SupportPostIgnoreFlags;
  closedAt?: Date;
  createdAt: NativeDate; // MongoDB field
  updatedAt: NativeDate; // MongoDB field
}

const SupportPostIgnoreFlagsSchema = new Schema<SupportPostIgnoreFlags>({
  reminder: { type: Boolean, required: false },
  close: { type: Boolean, required: false },
}, { _id: false });

const SupportPostFlags =  new Schema<SupportPostFlags>({
  noArchive: { type: Boolean, required: false },
}, { _id: false });

const SupportPostSchema = new Schema<ISupportPost>(
  {
    id: { type: String, required: true },
    postId: { type: String, required: true, unique: true },
    author: { type: String, required: true },
    closedAt: { type: Date, required: false },
    remindedAt: { type: Date, default: null },
    ignoreFlags: { type: SupportPostIgnoreFlagsSchema, required: false },
    flags: { type: SupportPostFlags, required: false },
  },
  { timestamps: true }
);

export const SupportPost = model<ISupportPost>(
  "supportPost",
  SupportPostSchema,
  "supportPosts"
);
