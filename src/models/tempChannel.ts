import { model, Schema } from "mongoose";

interface ITempChannelCategory {
  /**
   * The name of the temporary channel category.
   */
  name: string;
  /**
   * The ID of the guild where this category is located.
   * This is used to ensure that the category is unique within the guild.
   */
  guildId: string;
  /**
   * The naming scheme for temporary channels in this category.
   *
   * ### Placeholders:
   * - `number`: A sequential number for the channel.\
   *   Note, that there may be multiple channels with the same number if there are e.g. 3 channels (1, 2, 3) and the one with number 1 is deleted (2, 3) and a new channel is created, it will get the number 2 again (2, 3, 2))
   */
  namingScheme: string;
  /**
   * The maximum number of channels that can be created in this category.
   * This is used to limit the number of temporary channels to prevent spam.
   */
  maxChannels: number;
  /**
   * The maximum number of users that can be in a temporary channel.
   * This is used to limit the number of users in a temporary channel.
   */
  maxUsersPerChannel?: number;
  /**
   * The ID of the parent category in Discord.
   * This is used to create the channel in a specific category.
   *
   * If not provided, the channel will be created in the root of the guild.
   */
  parentId?: string;
}

interface ITempChannel {
  /**
   * The ID of the temporary voice channel.
   */
  channelId: string;
  /**
   * The ID of the guild where the temporary channel is located.
   * This is used to ensure that the channel is unique within the guild.
   */
  guildId: string;
  /**
   * The category to which this temporary channel belongs.
   * This is a reference to the {@link TempChannelCategory} model.
   */
  category: Schema.Types.ObjectId;
  /**
   * The number of users currently in the temporary voice channel.
   */
  userCount: number;
  /**
   * The index number of the temp channel.
   * It's set automatically when the channel is created.
   */
  number: number;
  createdAt: Date;
  updatedAt: Date;
}

const TempChannelCategorySchema = new Schema<ITempChannelCategory>({
  /**
   * The name of the temporary channel category.
   */
  name: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 100,
  },
  /**
   * The ID of the guild where this category is located.
   * This is used to ensure that the category is unique within the guild.
   */
  guildId: { type: String, required: true },
  /**
   * The naming scheme for temporary channels in this category.
   *
   * ### Placeholders:
   * - `number`: A sequential number for the channel.\
   *   Note, that there may be multiple channels with the same number if there are e.g. 3 channels (1, 2, 3) and the one with number 1 is deleted (2, 3) and a new channel is created, it will get the number 2 again (2, 3, 2))
   */
  namingScheme: { type: String, required: true, minlength: 3, maxlength: 100 },
  /**
   * The maximum number of channels that can be created in this category.
   * This is used to limit the number of temporary channels to prevent spam.
   */
  maxChannels: {
    type: Number,
    default: 10,
    min: 1,
    max: 100,
    required: true,
  },
  /**
   * The maximum number of users that can be in a temporary channel.
   * This is used to limit the number of users in a temporary channel.
   */
  maxUsersPerChannel: {
    type: Number,
    min: 1,
    max: 99,
    required: false,
  },
  /**
   * The ID of the parent category in Discord.
   * This is used to create the channel in a specific category.
   *
   * If not provided, the channel will be created in the root of the guild.
   */
  parentId: { type: String, required: false },
});

const TempChannelSchema = new Schema<ITempChannel>(
  {
    /**
     * The ID of the temporary voice channel.
     */
    channelId: { type: String, required: true },
    /**
     * The ID of the guild where the temporary channel is located.
     * This is used to ensure that the channel is unique within the guild.
     */
    guildId: { type: String, required: true },
    /**
     * The category to which this temporary channel belongs.
     * This is a reference to the {@link TempChannelCategory} model.
     */
    category: {
      type: Schema.Types.ObjectId,
      ref: "TempChannelCategory",
      required: true,
    },
    /**
     * The number of users currently in the temporary voice channel.
     */
    userCount: { type: Number, default: 0 },
    /**
     * The index number of the temp channel.
     * It's set automatically when the channel is created.
     */
    number: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

TempChannelSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

const TempChannelCategory = model<ITempChannelCategory>(
  "TempChannelCategory",
  TempChannelCategorySchema,
  "tempChannelCategories"
);

const TempChannel = model<ITempChannel>(
  "TempChannel",
  TempChannelSchema,
  "tempChannels"
);

export {
  TempChannelCategory,
  TempChannel,
  type ITempChannelCategory,
  type ITempChannel,
};
