import { model, Schema } from "mongoose";

export interface IUserStats {
  /**
   * The number of bugs reported by the user.
   */
  bugsReported: number;
  /**
   * The number of accepted feature requests.
   */
  featuresRequests: number;
}

export interface IUser {
  id: string;
  username: string;
  stats: IUserStats;
  createdAt: NativeDate;
  updatedAt: NativeDate;
}

const UserStatsSchema = new Schema<IUserStats>(
  {
    bugsReported: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    stats: {
      type: UserStatsSchema,
      default: { bugsReported: 0 },
    },
  },
  { timestamps: true }
);

export const DBUser = model<IUser>("User", UserSchema, "users");
