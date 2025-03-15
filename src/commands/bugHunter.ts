import dayjs from "dayjs";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import NodeCache from "node-cache";
import { FeatureRequest } from "../models/featureRequest.js";
import { DBUser } from "../models/user.js";
import { FeatureRequestStatus } from "../utils/enums.js";

const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  errorOnMissing: false,
});

export default {
  data: new SlashCommandBuilder()
    .setName("bugs")
    .setContexts(0)
    .setDescription("Bug hunter commands")
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
    const subcommand = ctx.options.getSubcommand(true);
    let targetUser = ctx.options.getUser("user") || ctx.user; // "user" option is given if dev-command, otherwise default to ctx.user

    let dbUser = await DBUser.findOne({ id: targetUser.id });
    if (["add", "remove"].includes(subcommand)) {
      if (!ctx.member.roles.cache.has(process.env.ROLE_DEVELOPER!)) {
        await ctx.reply({
          content: "Nice try! Only developers can award bug-finding glory.",
          flags: 64,
        });
        return;
      }

      if (!dbUser) {
        dbUser = await DBUser.create({
          id: targetUser!.id,
          username: targetUser!.username,
        });
      }
    } else if (!dbUser) {
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

    if (subcommand === "add") {
      await dbUser!.updateOne({
        $inc: { "stats.bugsReported": 1 },
      });

      await ctx.reply({
        content: `Bug count incremented for ${targetUser.username}! Total bugs reported: ${dbUser.stats.bugsReported}`,
        flags: 64,
      });
      return;
    } else if (subcommand === "remove") {
      await dbUser!.updateOne({
        $inc: { "stats.bugsReported": -1 },
      });

      await ctx.reply({
        content: `Bug count decremented for ${targetUser.username}! Total bugs reported: ${dbUser.stats.bugsReported}`,
        flags: 64,
      });
      return;
    }

    if (subcommand === "stats") {
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

      const targetMember = await ctx.guild.members.fetch(targetUser.id);

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

      await ctx.reply({
        embeds: [
          new EmbedBuilder({
            author: { name: "Bug Hunter Stats" },
            title: `${targetMember.displayName || targetUser.username}`,
            thumbnail: {
              url: targetUser.avatarURL() || targetUser.defaultAvatarURL,
            },
            color: 0xff5733,
            fields: [
              {
                name: "__Bugs Reported__",
                value: `\`${dbUser.stats.bugsReported}\``,
                inline: false,
              },
              {
                name: "__Feature Requests__",
                value: [
                  "All: `" + frStats.all + "`",
                  "Implemented: `" + frStats.implemented + "`",
                  "Pending: `" + frStats.pending + "`",
                  "Accepted: `" + frStats.accepted + "`",
                  "Denied: `" + frStats.denied + "`",
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
