import { model, Schema } from "mongoose";
const { supportTags } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

export interface SupportQuestionField {
  title: string;
  content: string;
}

export interface SupportQuestion {
  topic: "generalQuestion" | "techincalQuestion" | "error" | "bugReport";
  userId: string;
  fields: SupportQuestionField[];
  postId: string;
  state: keyof typeof supportTags;
  closed: boolean;
  closeTime: Date;
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

const SupportQuestionFieldSchema = new Schema<SupportQuestionField>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const SupportQuestionSchema = new Schema<SupportQuestion>(
  {
    topic: { type: String, required: true },
    userId: { type: String, required: true },
    fields: { type: [SupportQuestionFieldSchema], required: true },
    postId: { type: String, required: true },
    state: { type: String, default: "unsolved" },
    closed: { type: Boolean, required: false },
    closeTime: { type: Date, required: false },
  },
  { timestamps: true }
);

export const SupportQuestion = model<SupportQuestion>(
  "SupportQuestion",
  SupportQuestionSchema,
  "supportQuestions"
);
