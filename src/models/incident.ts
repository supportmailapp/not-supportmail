import { model, Schema, Document } from "mongoose";
import { IncidentStatus } from "../utils/enums.js";

export interface Incident extends Document {
  title: string;
  description: string;
  status: IncidentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema: Schema = new Schema<Incident>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: Number,
      default: IncidentStatus.Identified,
    },
  },
  { timestamps: true }
);

export const Incident = model<Incident>(
  "Incident",
  IncidentSchema,
  "incidents"
);
