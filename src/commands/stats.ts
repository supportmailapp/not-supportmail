import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import NodeCache from "node-cache";
import { DBUser } from "../models/user.js";
import { EphemeralFlags } from "../utils/enums.js";

const cache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  errorOnMissing: false,
});

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setContexts(0)
  .setDescription("View user statistics")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("User to check stats for (defaults to yourself)")
      .setRequired(false),
  );

export async function run(ctx: ChatInputCommandInteraction) {
  if (!ctx.inCachedGuild()) return;

  // Initialize response flags based on channel
  let responseFlags =
    ctx.channelId !== Bun.env.CHANNEL_BOT_COMMANDS ? EphemeralFlags : undefined;

  let targetUser = ctx.options.getUser("user") ?? ctx.user;

  const cacheValue = cache.get(`${ctx.user.id}-${targetUser.id}`) as
    | string
    | undefined;
  if (cacheValue) {
    responseFlags = EphemeralFlags;
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

  const statsEmbed = new EmbedBuilder()
    .setAuthor({ name: "User Statistics" })
    .setTitle(
      targetMember.displayName || targetUser.globalName || targetUser.username,
    )
    .setThumbnail(targetUser.avatarURL() || targetUser.defaultAvatarURL)
    .setColor(0xff5733)
    .addFields([
      {
        name: "__Bugs Reported__",
        value: `- \`${dbUser.stats.bugsReported}\``,
        inline: false,
      },
    ])
    .setTimestamp();

  await ctx.reply({
    embeds: [statsEmbed],
    flags: responseFlags,
  });

  if (ctx.channelId === Bun.env.CHANNEL_BOT_COMMANDS) {
    cache.set(`${ctx.user.id}-${targetUser.id}`, true);
  }
}
