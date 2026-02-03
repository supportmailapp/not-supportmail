import { Message } from "discord.js";
import wildcardMatch from "wildcard-match";
import suggestSolveCache from "../../caches/suggestSolveCache";

const SUGGEST_SOLVE_PATTERNS = [
  "*solved*",
  "*issue resolved*",
  "*fixed*",
  "*problem fixed*",
  "*thanks*worked*",
  "*thank you*worked*",
  "*worked*thanks*",
  "*worked*thank you*",
  "*resolved*",
  "*i fixed it*",
  "*i solved it*",
  "*all good now*",
  "*never mind*fixed it*",
];

export default async function suggestSolve(msg: Message) {
  if (!msg.inGuild() || msg.author.bot) return;
  if (msg.channel.parentId !== Bun.env.CHANNEL_SUPPORT_FORUM) return;

  const setting = await suggestSolveCache.get(msg.author.id);
  if (!setting) return;

  const content = msg.content;
  for (const pattern of SUGGEST_SOLVE_PATTERNS) {
    const isMatch = wildcardMatch(pattern, { flags: "i" });
    if (isMatch(content)) {
      msg.react("✅").catch(() => null);
      return;
    }
  }
}
