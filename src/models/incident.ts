import { model, Schema } from "mongoose";
import { IncidentStatus } from "../utils/enums.js";
import { DiscordSnowflake } from "@sapphire/snowflake";

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
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

function genSnowflake() {
  return DiscordSnowflake.generate();
}

const StatusUpdateSchema: Schema = new Schema<IStatusUpdate>(
  {
    id: { type: Schema.Types.BigInt, default: genSnowflake, unique: true },
    content: { type: String, required: true },
    status: { type: Number, required: true },
    incidentId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Incident",
    },
  },
  { timestamps: true }
);

export const StatusUpdate = model<IStatusUpdate>(
  "StatusUpdate",
  StatusUpdateSchema,
  "statusUpdates"
);

export interface IIncident {
  title: string;
  messageId?: string;
  status: IncidentStatus;
  createdAt: NativeDate;
  updatedAt: NativeDate;
  resolvedAt?: Date;
}

const IncidentSchema: Schema = new Schema<IIncident>(
  {
    title: { type: String, required: true },
    messageId: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Incident = model<IIncident>(
  "Incident",
  IncidentSchema,
  "incidents"
);
