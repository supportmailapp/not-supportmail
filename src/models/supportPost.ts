import { model, Schema } from "mongoose";

export interface SupportPostIgnoreFlags {
  /**
   * If `true` then no reminder should be sent.
   *
   * Note, that if this is set, automtic close will still happen.
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
  closedAt: Date | null;
  ignoreFlags?: SupportPostIgnoreFlags;
  flags?: SupportPostFlags;
  lastActivity: Date | null;
  createdAt: NativeDate; // MongoDB field
  updatedAt: NativeDate; // MongoDB field
}

const SupportPostIgnoreFlagsSchema = new Schema<SupportPostIgnoreFlags>(
  {
    reminder: { type: Boolean, required: false },
    close: { type: Boolean, required: false },
  },
  { _id: false }
);

const SupportPostFlags = new Schema<SupportPostFlags>(
  {
    noArchive: { type: Boolean, required: false },
  },
  { _id: false }
);

const SupportPostSchema = new Schema<ISupportPost>(
  {
    id: { type: String, required: true },
    postId: { type: String, required: true, unique: true },
    author: { type: String, required: true },
    closedAt: { type: Date, default: null },
    remindedAt: { type: Date, default: null },
    ignoreFlags: { type: SupportPostIgnoreFlagsSchema, required: false },
    flags: { type: SupportPostFlags, required: false },
    lastActivity: { type: Date, default: new Date() },
  },
  { timestamps: true }
);

export const SupportPost = model<ISupportPost>(
  "supportPost",
  SupportPostSchema,
  "supportPosts"
);
