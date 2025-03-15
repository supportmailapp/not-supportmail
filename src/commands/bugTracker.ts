import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DBUser } from "../models/user.js";

const BUG_TRACKER_THRESHOLD = 5;

export default {
  data: new SlashCommandBuilder()
    .setName("bug-tracker")
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
    const targetUser = ctx.options.getUser("user", true);
    const member = await ctx.guild.members.fetch(ctx.user.id);

    if (!ctx.member.roles.cache.has(process.env.ROLE_DEVELOPER!)) {
      await ctx.reply({
        content: "Nice try! Only developers can award bug-finding glory.",
        flags: 64,
      });
      return;
    }

    let dbUser = await DBUser.findOne({ id: targetUser.id });
    if (!dbUser) {
      dbUser = await DBUser.create({
        id: targetUser!.id,
        username: targetUser!.username,
        displayName: targetUser.displayName || targetUser.username,
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

      await ctx.reply({
        content:
          `Bug count incremented for ${targetUser.username}! Total bugs reported: ${newCount}` +
          (roleAdded
            ? "\n\nUser has also been awarded the Bug Hunter role!"
            : ""),
        flags: 64,
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

      await ctx.reply({
        content:
          `Bug count decremented for ${targetUser.username}! Total bugs reported: ${newCount}` +
          (roleRemoved ? "\n\nUser has also lost the Bug Hunter role!" : ""),
        flags: 64,
      });
      return;
    }
  },
};
