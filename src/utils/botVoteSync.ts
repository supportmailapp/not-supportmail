import { Client } from "discord.js";
import { BotVoteDocument } from "../models/botVote.js";
import config from "../config.js";

export default async function botVoteSync(
  client: Client,
  botVote: BotVoteDocument
) {
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) return; // This should never happen

  const member =
    guild.members.cache?.get(botVote.userId) ||
    (await guild.members.fetch(botVote.userId).catch(() => {}));
  if (!member) return;

  await member.roles.add(config.voteRoleId).catch(console.error);

  await botVote.updateOne({ synced: true });
}
