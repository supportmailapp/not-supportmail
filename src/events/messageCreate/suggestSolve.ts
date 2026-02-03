import { ChannelType, Message } from "discord.js";
import wildcardMatch from "wildcard-match";
import suggestSolveCache from "../../caches/suggestSolveCache";
import { buildSuggestSolveMessage } from "../../utils/main";
import config from "../../config";

const SUGGEST_SOLVE_PATTERNS = [
  "*solved*",
  "*issue resolved*",
  "*fixed*",
  "*problem fixed*",
  "*thanks*",
  "*thank you*",
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

const allTags = Object.values(config.supportTags);

export async function suggestSolve(msg: Message) {
  if (
    !msg.inGuild() ||
    msg.author.bot ||
    msg.channel.parentId !== config.channels.supportForum ||
    msg.channel.type !== ChannelType.PublicThread ||
    msg.channel.ownerId !== msg.author.id || // Only suggest in user's own threads
    msg.channel.appliedTags.some((tag) => allTags.includes(tag))
  ) {
    console.log("Suggest solve: conditions not met, exiting.", {
      guildid: msg.guild?.id,
      author: msg.author.id,
      channel: msg.channel.id,
      bot: msg.author.bot,
      parentid: (msg.channel as any).parentId,
      type: msg.channel.type,
      ownerid: (msg.channel as any).ownerId,
      appliedtags: (msg.channel as any).appliedTags,
    });
    return;
  }

  const content = msg.content.replace(/\s+/g, " ").replace("\n", " ");
  for (const pattern of SUGGEST_SOLVE_PATTERNS) {
    const isMatch = wildcardMatch(pattern, { flags: "i" });
    if (isMatch(content)) {
      // check author here because wildcard is is faster than DB call, so we only want to do DB call if necessary
      const setting = await suggestSolveCache.get(msg.author.id);
      if (!setting) return;
      const message = await buildSuggestSolveMessage(msg.client);
      return msg.reply({ ...message, allowedMentions: { repliedUser: false } });
    }
  }
}
