import { REST, Routes } from "discord.js";
import { MongoClient } from "mongodb";
import type { IBotVote } from "supportmail-types";

const client = new MongoClient(process.env.MONGO_URI_MAIN);
const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

async function syncVotes() {
  await client.connect();
  const db = client.db();
  const botVoteCollection = db.collection<IBotVote>("botVotes");
  let votesToRemove = await botVoteCollection
    .find({
      $and: [
        { hasRole: true },
        { removeRoleBy: { $exists: true } },
        { removeRoleBy: { $lte: new Date() } },
      ],
    })
    .sort({ removeRoleBy: 1 })
    .toArray();

  if (votesToRemove.length == 0) return;

  const uniqueVotes = votesToRemove.reduce((acc, vote) => {
    if (!acc.find((v) => v.userId === vote.userId)) {
      acc.push(vote);
    }
    return acc;
  }, []);

  if (uniqueVotes.length == 0) return;

  for (const vote of uniqueVotes) {
    await rest
      .delete(
        Routes.guildMemberRole(
          process.env.GUILD_ID,
          vote.userId,
          process.env.ROLE_VOTER
        )
      )
      .catch(() => {});
  }

  await botVoteCollection.deleteMany({
    userId: { $in: uniqueVotes.map((v) => v.userId) },
  });
  await client.close();
}

await syncVotes();
