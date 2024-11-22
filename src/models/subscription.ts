import { model, Schema } from "mongoose";

interface ISubscription {
  serverId: string;
  userId: string;
  customerId: string;
  subscriptionId: string;
  productId: string;
  lastPayment: Date | null;
  cancelledAt: Date | null;
  updatedAt: NativeDate;
  createdAt: NativeDate;
}

export const Subscription = model<ISubscription>(
  "Subscription",
  new Schema<ISubscription>(
    {
      serverId: { type: String, required: true },
      userId: { type: String, required: true },
      customerId: { type: String, required: true },
      subscriptionId: { type: String, required: true },
      productId: { type: String, required: true },
      lastPayment: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
  "subscriptions"
);
