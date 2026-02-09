import { model, Schema } from "mongoose";

interface ISupportPost {
  postId: string;
  /**
   * Must not match the post author id if the post was created by a moderator on behalf of a user.
   */
  userId: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const spSchema = new Schema<ISupportPost>({
  postId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const SupportPost = model<ISupportPost>(
  "SupportPost",
  spSchema,
  "supportPosts",
);
