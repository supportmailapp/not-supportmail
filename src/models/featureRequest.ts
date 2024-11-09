import { model, Schema } from "mongoose";
import {
  FeatureRequestCategory,
  FeatureRequestStatus,
} from "../utils/enums.js";

export interface IFeatureRequest {
  userId: string;
  category: FeatureRequestCategory;
  /**
   * Only required if `category` is `FeatureRequestCategory.Other`
   */
  customCategory?: string;
  shortDescription: string;
  longDescription: string;
  whyBenefit: string;
  status: FeatureRequestStatus;
  /**
   * * This can only be set after the message was sent because the message needs the `_id` of the feature request
   */
  threadId?: string;
  createdAt: NativeDate;
  updatedAt: NativeDate;
}

const featureRequestSchema = new Schema<IFeatureRequest>(
  {
    userId: { type: String, required: true },
    category: { type: Number, required: true },
    customCategory: { type: String, required: false },
    shortDescription: { type: String, required: true },
    longDescription: { type: String, required: true },
    whyBenefit: { type: String, required: true },
    status: { type: Number, default: FeatureRequestStatus.Pending },
    threadId: { type: String, required: false },
  },
  { timestamps: true }
);

export const FeatureRequest = model<IFeatureRequest>(
  "FeatureRequest",
  featureRequestSchema,
  "featureRequests"
);
