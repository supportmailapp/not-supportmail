import { DiscordSnowflake } from "@sapphire/snowflake";
import { model, Schema } from "mongoose";
import { IncidentStatus } from "../utils/enums.js";

export interface BetterstackReportData {
  /**
   * The ID of the status page report.
   *
   * Can be null if the report is not created on BetterStack.
   */
  id: string | null;
}

export type IncidentType = "incident" | "maintenance";

export interface IIncident {
  title: string;
  typ: IncidentType;
  /**
   * The current status of the incident.
   *
   * Inferred from the last status update.
   */
  aggregatedStatus: IncidentStatus;
  betterstack: BetterstackReportData;
  messageId: string | null;
  resolvedAt?: Date;
  createdAt: NativeDate;
  updatedAt: NativeDate;
}

const BetterstackReportDataSchema = new Schema<BetterstackReportData>(
  {
    id: { type: String, default: null },
  },
  { _id: false }
);

const IncidentSchema: Schema = new Schema<IIncident>(
  {
    title: { type: String, required: true },
    typ: {
      type: String,
      required: true,
      enum: ["incident", "maintenance"],
    },
    resolvedAt: { type: Date, default: null },
    aggregatedStatus: {
      type: Number,
      required: true,
      enum: [0, 1, 2, 3, 4, 5],
    },
    betterstack: { type: BetterstackReportDataSchema, default: { id: null } },
    messageId: { type: String, default: null },
  },
  { timestamps: true }
);

export const Incident = model<IIncident>(
  "Incident",
  IncidentSchema,
  "incidents"
);

export interface BetterstackStatusUpdate {
  /**
   * The ID of the status update.
   */
  id: string;
}

export interface IStatusUpdate {
  /**
   * The unique identifier of the status update.
   *
   * This automatically set and corresponds to the current snowflake timestamp.
   */
  id: BigInt;
  status: IncidentStatus;
  content: string;
  incidentId: Schema.Types.ObjectId;
  betterstack: BetterstackReportData;
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

function genSnowflake() {
  return DiscordSnowflake.generate();
}

const BetterstackStatusUpdateSchema = new Schema<BetterstackReportData>(
  {
    id: { type: String, default: null },
  },
  { _id: false }
);

const StatusUpdateSchema: Schema = new Schema<IStatusUpdate>(
  {
    id: { type: Schema.Types.BigInt, default: genSnowflake, unique: true },
    content: { type: String, required: true },
    status: { type: Number, required: true, enum: [0, 1, 2, 3, 4, 5] },
    incidentId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Incident",
    },
    betterstack: { type: BetterstackStatusUpdateSchema, default: { id: null } },
  },
  { timestamps: true }
);

export const StatusUpdate = model<IStatusUpdate>(
  "StatusUpdate",
  StatusUpdateSchema,
  "statusUpdates"
);
