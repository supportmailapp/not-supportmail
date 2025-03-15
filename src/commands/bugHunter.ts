import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { DBUser } from "../models/user.js";
import { FeatureRequest } from "../models/featureRequest.js";
import { FeatureRequestStatus } from "../utils/enums.js";
import NodeCache from "node-cache";
import dayjs from "dayjs";

const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  errorOnMissing: false,
});

export default {
  data: new SlashCommandBuilder()
    .setName("bug-hunter")
    .setContexts(0)
    .setDescription("Bug hunter commands")
    .addSubcommandGroup((subcommandGroup) =>
      subcommandGroup
        .setName("bugs")
        .setDescription("Bug reporting commands")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Increment bug count for a user")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user to increment bug count for")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Decrement bug count for a user")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("The user to decrement bug count for")
                .setRequired(true)
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stats")
        .setDescription("View bug hunter stats")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to check stats for (defaults to yourself)")
            .setRequired(false)
        )
    ),

  async run(ctx: ChatInputCommandInteraction) {
    if (!ctx.inCachedGuild()) return; // TS bullshit
    const subcommandGroup = ctx.options.getSubcommandGroup(false);
    const subcommand = ctx.options.getSubcommand(true);

    if (["bugs"].includes(subcommandGroup || "")) {
      if (!ctx.member.roles.cache.has(process.env.ROLE_DEVELOPER!)) {
        await ctx.reply({
          content: "Nice try! Only developers can award bug-finding glory.",
          flags: 64,
        });
        return;
      }
    }

    if (subcommandGroup === "bugs" && subcommand === "add") {
      const targetUser = ctx.options.getUser("user", true);

      // Find or create user
      let dbUser = await DBUser.findOne({ id: targetUser.id });

      if (!dbUser) {
        dbUser = await DBUser.create({
          id: targetUser.id,
          username: targetUser.username,
        });
      }

      await dbUser.updateOne({
        $inc: { "stats.bugsReported": 1 },
      });

      await ctx.reply({
        content: `Bug count incremented for ${targetUser.username}! Total bugs reported: ${dbUser.stats.bugsReported}`,
        flags: 64,
      });
      return;
    } else if (subcommandGroup === "bugs" && subcommand === "remove") {
      const targetUser = ctx.options.getUser("user", true);

      // Find or create user
      let dbUser = await DBUser.findOne({ id: targetUser.id });

      if (!dbUser) {
        await ctx.reply({
          content: `${targetUser.username} hasn't reported any bugs yet!`,
          flags: 64,
        });
        return;
      }

      await dbUser.updateOne({
        $inc: { "stats.bugsReported": -1 },
      });

      await ctx.reply({
        content: `Bug count decremented for ${targetUser.username}! Total bugs reported: ${dbUser.stats.bugsReported}`,
        flags: 64,
      });
      return;
    }

    if (subcommandGroup === null && subcommand === "stats") {
      const targetUser = ctx.options.getUser("user") || ctx.user;

      const cacheValue = cache.get(`${ctx.user.id}-${targetUser.id}`) as
        | string
        | undefined;
      if (cacheValue) {
        await ctx.reply({
          content: `You are doing this too fast. Try again <t:${dayjs(
            cacheValue
          ).unix()}:R>.`,
          flags: 64,
        });
        return;
      }

      const dbUser = await DBUser.findOne({ id: targetUser.id });
      const featureRequests = await FeatureRequest.find({
        userId: targetUser.id,
      });
      const frStats = {
        all: featureRequests.length.toString(),
        implemented: featureRequests
          .filter((fr) => fr.status === FeatureRequestStatus.Implemented)
          .length.toString(),
        pending: featureRequests
          .filter((fr) => fr.status === FeatureRequestStatus.Pending)
          .length.toString(),
        accepted: featureRequests
          .filter((fr) => fr.status === FeatureRequestStatus.Accepted)
          .length.toString(),
        denied: featureRequests
          .filter((fr) => fr.status === FeatureRequestStatus.Denied)
          .length.toString(),
      };

      if (!dbUser) {
        await ctx.reply({
          content: `${
            targetUser.id === ctx.user.id
              ? "You haven't"
              : `${targetUser.username} hasn't`
          } reported any bugs yet!`,
          flags: 64,
        });
        return;
      }

      await ctx.reply({
        embeds: [
          new EmbedBuilder({
            title: `Bug Hunter Stats: ${targetUser.username}`.slice(0, 100),
            thumbnail: {
              url: targetUser.avatarURL() || targetUser.defaultAvatarURL,
            },
            color: 0xff5733,
            fields: [
              {
                name: "__Bugs Reported__",
                value: dbUser.stats.bugsReported.toString(),
                inline: false,
              },
              {
                name: "__Feature Requests__",
                value: [
                  "All: " + frStats.all,
                  "Implemented: " + frStats.implemented,
                  "Pending: " + frStats.pending,
                  "Accepted: " + frStats.accepted,
                  "Denied: " + frStats.denied,
                ].join("\n"),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          }),
        ],
        flags:
          ctx.channelId !== process.env.BOT_COMMANDS_CHANNEL ? 64 : undefined,
      });

      if (ctx.channelId === process.env.BOT_COMMANDS_CHANNEL) {
        cache.set(
          `${ctx.user.id}-${targetUser.id}`,
          dayjs().add(10, "minutes").toISOString()
        );
      }
    }
  },
};
