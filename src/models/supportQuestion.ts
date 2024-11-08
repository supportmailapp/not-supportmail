import { model, Schema } from "mongoose";
const { supportTags } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

/**
 * - `question`: The user's question.
 * - `documentation-links`: Links to the documentation they've read.
 */
export type GeneralQuestionTitle = "question" | "documentation-links";
/**
 * - `question`: The user's question.
 * - `feature`: The feature this question is related to.
 */
export type TechnicalQuestionTitle = "question" | "feature";
/**
 * - `feature`: The feature this error is related to.
 * - `error`: The error message (if any).
 * - `steps`: The steps to reproduce the error.
 * - `expected`: The expected result.
 * - `actual`: The actual result.
 */
export type ErrorTitle = "feature" | "error" | "steps" | "expected" | "actual";
/**
 * - `description`: The bug the user is reporting.
 * - `steps`: The steps to reproduce the bug.
 * - `expected`: The expected result.
 * - `actual`: The actual result.
 * - `tried`: What they tried to fix the bug.
 * - `serverids`: The server IDs related to this bug. (if any)
 */
export type BugReportTitle =
  | "bug-description"
  | "steps"
  | "expected"
  | "actual"
  | "tried"
  | "serverids";

export type AnySupportQuestionTitle =
  | GeneralQuestionTitle
  | TechnicalQuestionTitle
  | ErrorTitle
  | BugReportTitle;

export const SupportQuestionLabelMap = {
  question: "Question",
  "documentation-links": "Documentation Links",
  feature: "Related Feature",
  error: "Error Message",
  steps: "Steps to Reproduce",
  expected: "Expected Result",
  actual: "Actual Result",
  "bug-description": "Description",
  tried: "What was tried and if it worked",
  serverids: "Related Server/Channel IDs",
};

export type SupportQuestionType =
  | "generalQuestion"
  | "techincalQuestion"
  | "error"
  | "bugReport";

export const SupportQuestionTypeMap = {
  generalQuestion: "General Question",
  techincalQuestion: "Technical Question",
  error: "Error",
  bugReport: "Bug Report",
};

export interface SupportQuestionField {
  /**
   * The key of the question label.
   */
  title: AnySupportQuestionTitle;
  /**
   * The user's response to the question.
   */
  content: string;
}

export interface SupportQuestion {
  _type: SupportQuestionType;
  userId: string;
  fields: SupportQuestionField[];
  attachments: string[]; // Array of Attachment URLs
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
    _type: { type: String, required: true },
    userId: { type: String, required: true },
    fields: { type: [SupportQuestionFieldSchema], required: true },
    attachments: { type: [String], required: false },
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
