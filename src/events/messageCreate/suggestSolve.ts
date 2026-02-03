import { ChannelType, Colors, ContainerBuilder, Message } from "discord.js";
import wildcardMatch from "wildcard-match";
import suggestSolveCache from "../../caches/suggestSolveCache";
import { ComponentsV2Flags } from "../../utils/enums";

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
  if (
    !msg.inGuild() ||
    msg.author.bot ||
    msg.channel.parentId !== Bun.env.CHANNEL_SUPPORT_FORUM ||
    msg.channel.type !== ChannelType.PublicThread ||
    msg.channel.ownerId !== msg.author.id // Only suggest in user's own threads
  ) {
    return;
  }

  const setting = await suggestSolveCache.get(msg.author.id);
  if (!setting) return;

  const command = msg.client.application.commands.cache.find(
    (c) => c.name === "question",
  );
  const commandMention = command
    ? `</question solve:${command.id}>`
    : "`/question solve`";
  const content = msg.content;
  for (const pattern of SUGGEST_SOLVE_PATTERNS) {
    const isMatch = wildcardMatch(pattern, { flags: "i" });
    if (isMatch(content)) {
      return msg.channel.send({
        flags: ComponentsV2Flags,
        components: [
          new ContainerBuilder()
            .setAccentColor(Colors.Blurple)
            .addTextDisplayComponents((t) =>
              t.setContent(
                `-# > It looks like your issue has been resolved! Please use ${commandMention} to mark your post as solved.\n-# > This helps to reduce clutter.`,
              ),
            ),
        ],
      });
    }
  }
}
