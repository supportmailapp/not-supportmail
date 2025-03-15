import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DBUser } from "../models/user.js";

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
    let targetUser = ctx.options.getUser("user", true);

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
  },
};
