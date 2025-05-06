import {
  ChatInputCommandInteraction,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { DBUser } from "../models/user.js";

const BUG_TRACKER_THRESHOLD = 5;

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
    ),

  async run(ctx: ChatInputCommandInteraction) {
    if (!ctx.inCachedGuild()) return; // TS bullshit
    const subcommand = ctx.options.getSubcommand(true);
    let member = ctx.options.getMember("user");
    if (!member) {
      member = await ctx.guild.members
        .fetch(ctx.options.getUser("user")!.id)
        .catch(null);
    }
    if (!member) {
      // Should really not happen, but just in case
      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: [
          new TextDisplayBuilder({
            content: "User not found!",
          }),
        ],
      });
      return;
    }

    if (!ctx.member.roles.cache.has(process.env.ROLE_DEVELOPER!)) {
      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: [
          new TextDisplayBuilder({
            content: "Nice try! Only developers can award bug-finding glory.",
          }),
        ],
      });
      return;
    }

    let dbUser = await DBUser.findOne({ id: member.id });
    if (!dbUser) {
      dbUser = await DBUser.create({
        id: member!.id,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
      });
    }

    if (subcommand === "add") {
      const newCount = dbUser.stats.bugsReported + 1;
      await dbUser.updateOne({
        $set: {
          "stats.bugsReported": newCount,
        },
      });

      let roleAdded = false;
      if (
        newCount >= BUG_TRACKER_THRESHOLD &&
        !member.roles.cache.has(process.env.ROLE_BUG_HUNTER!)
      ) {
        await member.roles.add(process.env.ROLE_BUG_HUNTER!);
        roleAdded = true;
      }

      const comps: any[] = [
        new TextDisplayBuilder({
          content: `Bug count incremented for ${member.user.displayName}! Total bugs reported: ${newCount}`,
        }),
      ];
      if (roleAdded) {
        comps.push(
          new SeparatorBuilder(),
          new TextDisplayBuilder({
            content: "User has also been awarded the Bug Hunter role!",
          })
        );
      }

      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: comps,
      });
      return;
    } else if (subcommand === "remove") {
      const newCount = Math.max(0, dbUser.stats.bugsReported - 1);
      await dbUser.updateOne({
        $set: {
          "stats.bugsReported": newCount,
        },
      });

      let roleRemoved = false;
      if (
        newCount < BUG_TRACKER_THRESHOLD &&
        member.roles.cache.has(process.env.ROLE_BUG_HUNTER!)
      ) {
        await member.roles.remove(process.env.ROLE_BUG_HUNTER!);
        roleRemoved = true;
      }

      const comps: any[] = [
        new TextDisplayBuilder({
          content: `Bug count decremented for ${member.user.displayName}! Total bugs reported: ${newCount}`,
        }),
      ];
      if (roleRemoved) {
        comps.push(
          new SeparatorBuilder(),
          new TextDisplayBuilder({
            content: "User has also lost the Bug Hunter role!",
          })
        );
      }

      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: comps,
      });
      return;
    }
  },
};
