import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import NodeCache from "node-cache";
import { FeatureRequest } from "../models/featureRequest.js";
import { SupportPost } from "../models/supportPost.js";
import { DBUser } from "../models/user.js";
import { FeatureRequestStatus } from "../utils/enums.js";

const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  errorOnMissing: false,
});

export default {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setContexts(0)
    .setDescription("View user statistics")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check stats for (defaults to yourself)")
        .setRequired(false)
    ),

  async run(ctx: ChatInputCommandInteraction) {
    if (!ctx.inCachedGuild()) return;

    // Initialize response flags based on channel
    let responseFlags =
      ctx.channelId !== process.env.CHANNEL_BOT_COMMANDS ? 64 : undefined;

    let targetUser = ctx.options.getUser("user") ?? ctx.user;

    const cacheValue = cache.get(`${ctx.user.id}-${targetUser.id}`) as
      | string
      | undefined;
    if (cacheValue) {
      responseFlags = 64;
    }

    let dbUser = await DBUser.findOne({ id: targetUser.id });
    const targetMember = await ctx.guild.members.fetch(targetUser.id);
    if (!dbUser) {
      dbUser = await DBUser.create({
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetMember.displayName || targetUser.username,
      });
    }

    // Get feature request stats
    const featureRequests = await FeatureRequest.find({
      userId: targetUser.id,
    });
    const filterFRs = (status: FeatureRequestStatus) => {
      return featureRequests
        .filter((fr) => fr.status === status)
        .length.toString();
    };
    const frStats = {
      all: featureRequests.length.toString(),
      implemented: filterFRs(FeatureRequestStatus.Implemented),
      pending: filterFRs(FeatureRequestStatus.Pending),
      accepted: filterFRs(FeatureRequestStatus.Accepted),
      denied: filterFRs(FeatureRequestStatus.Denied),
    };

    // Get support post stats
    const supportPosts = await SupportPost.countDocuments({
      author: targetUser.id,
    });
    const helpfulCount = await SupportPost.countDocuments({
      helped: { $in: [targetUser.id] },
    });

    if (!supportPosts && !helpfulCount && !featureRequests.length) {
      await ctx.reply({
        content: `${
          targetUser.id === ctx.user.id
            ? "You haven't"
            : `${targetUser.username} hasn't`
        } contributed yet!`,
        flags: 64,
      });
      return;
    }

    await ctx.reply({
      embeds: [
        new EmbedBuilder({
          author: { name: "User Statistics" },
          title: `${targetMember.displayName || targetUser.username}`,
          thumbnail: {
            url: targetUser.avatarURL() || targetUser.defaultAvatarURL,
          },
          color: 0xff5733,
          fields: [
            {
              name: "__Bugs Reported__",
              value: `- \`${dbUser.stats.bugsReported}\``,
              inline: false,
            },
            {
              name: "__Support Posts__",
              value: `- Created: \`${supportPosts}\`\n- Helped in: \`${helpfulCount}\``,
              inline: false,
            },
            {
              name: "__Feature Requests__",
              value: [
                "- All: `" + frStats.all + "`",
                "- Implemented: `" + frStats.implemented + "`",
                "- Pending: `" + frStats.pending + "`",
                "- Accepted: `" + frStats.accepted + "`",
                "- Denied: `" + frStats.denied + "`",
              ].join("\n"),
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        }),
      ],
      flags: responseFlags,
    });

    if (ctx.channelId === process.env.CHANNEL_BOT_COMMANDS) {
      cache.set(`${ctx.user.id}-${targetUser.id}`, true);
    }
  },
};
