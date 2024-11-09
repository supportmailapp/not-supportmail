import { model, Schema } from "mongoose";
import { IncidentStatus } from "../utils/enums.js";

export interface IStatusUpdate {
  id: number;
  status: IncidentStatus;
  content: string;
  incidentId: Schema.Types.ObjectId;
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

const StatusUpdateSchema: Schema = new Schema<IStatusUpdate>(
  {
    id: { type: Number, default: Date.now() },
    content: { type: String, required: true },
    status: { type: Number, required: true },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
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
