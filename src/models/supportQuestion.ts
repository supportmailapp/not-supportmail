import dayjs from "dayjs";
import { model, Schema } from "mongoose";

/**
 * - `question`: The user's question.
 * - `documentation-links`: Links to the documentation they've read.
 */
export type GeneralQuestionTitle = "question" | "documentation-links";
/**
 * - `question`: The user's question.
 * - `whyask`: The reason they're asking the question.
 */
export type TechnicalQuestionTitle = "question" | "whyask";
/**
 * - `feature`: The feature this error is related to.
 * - `error`: The error message (if any).
 * - `steps`: The steps to reproduce the error.
 * - `expected`: The expected result.
 */
export type ErrorTitle = "feature" | "error" | "steps" | "expected";
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
  whyask: "Why are you asking this question?",
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
  | "technicalQuestion"
  | "error"
  | "bugReport";

export const SupportQuestionTypeMap = {
  generalQuestion: "General Question",
  technicalQuestion: "Technical Question",
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
  content?: string | null;
}

export type QuestionState =
  | "unsolved"
  | "resolved"
  | "reviewNeeded"
  | "pending";

export type ISupportQuestionFlags = {
  noAutoClose?: boolean;
  /**
   * If the user has been reminded.
   *
   * When this is `true`, the post will be archived after 48 hours of total inactivity.
   */
  reminded: boolean;
};

export interface ISupportQuestion {
  _type: SupportQuestionType;
  userId: string;
  fields: SupportQuestionField[];
  /**
   * Array of Attachment URLs.
   */
  attachments: string[];
  postId: string;
  state: QuestionState;
  lastActivity: Date;

  resolved: boolean;
  /**
   * The time the post was closed.
   */
  closedAt?: Date;
  flags: ISupportQuestionFlags;
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

const SupportQuestionFieldSchema = new Schema<SupportQuestionField>(
  {
    title: { type: String, required: true },
    content: { type: String, required: false },
  },
  { _id: false }
);

const SupportQuestionFlagsSchema = new Schema<ISupportQuestionFlags>(
  {
    noAutoClose: { type: Boolean, required: false },
    reminded: { type: Boolean, default: false },
  },
  { _id: false }
);

const SupportQuestionSchema = new Schema<ISupportQuestion>(
  {
    _type: {
      type: String,
      enum: ["generalQuestion", "technicalQuestion", "error", "bugReport"],
      required: true,
    },
    userId: { type: String, required: true },
    fields: { type: [SupportQuestionFieldSchema], required: true },
    attachments: { type: [String], required: false },
    postId: { type: String, required: true, unique: true },
    state: {
      type: String,
      enum: ["unsolved", "resolved", "reviewNeeded", "pending"],
      default: "unsolved",
    },
    lastActivity: { type: Date, default: dayjs().toDate() },
    resolved: { type: Boolean, required: false },
    closedAt: { type: Date, required: false },
    flags: { type: SupportQuestionFlagsSchema, default: new Object() },
  },
  { timestamps: true }
);

SupportQuestionSchema.pre("save", function (next) {
  this.lastActivity = dayjs().toDate();
  next();
});

const supportQuestion = model<ISupportQuestion>(
  "SupportQuestion",
  SupportQuestionSchema,
  "supportQuestions"
);

supportQuestion.prependListener("save", function () {
  this.lastActivity = dayjs().toDate();
});

export const SupportQuestion = supportQuestion;
