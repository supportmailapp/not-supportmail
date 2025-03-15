import { type StringSelectMenuInteraction } from "discord.js";
import { SupportPost } from "../models/supportPost.js";
import { DBUser } from "../models/user.js";
import * as UsersCache from "../caches/helpfulUsers.js";
import { buildHelpfulResponse } from "../utils/main.js";

export default {
  prefix: "helpful",

  async run(ctx: StringSelectMenuInteraction) {
    await ctx.update({ content: "Saving..." });

    await SupportPost.findOneAndUpdate(
      { postId: ctx.channelId },
      { $push: { helped: { $each: ctx.values } } }
    );

    let users = await DBUser.find(
      {
        id: { $in: UsersCache.takeUsers(ctx.channelId) },
      },
      null,
      {
        limit: 25, // just in case
      }
    );
    users = users.filter((u) => !ctx.values.includes(u.id));

    if (users.length > 0) {
      UsersCache.setUsers(
        ctx.channelId,
        users.map((u) => u.id)
      );

      await ctx.editReply(buildHelpfulResponse(users));
    } else {
      await ctx.editReply("No more users to show. Thank you!");
    }
  },
};
