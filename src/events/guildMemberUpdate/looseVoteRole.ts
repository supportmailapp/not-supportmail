import dayjs from "dayjs";
import {
  ActionRowBuilder,
  ApplicationCommand,
  ButtonBuilder,
  ClientEvents,
  Colors,
  ContainerBuilder,
  GuildResolvable,
  userMention,
} from "discord.js";
import { DBUser } from "../../models/user.js";
import { ComponentsV2Flags } from "../../utils/enums.js";
import { botVoteBtns } from "../../utils/main.js";
import * as Sentry from "@sentry/node";

const pm = (userId: string, botIds: string[]) => {
  return (
    `**Hey ${userMention(userId)}! You've just lost the vote role for ${botIds
      .map(userMention)
      .join(", ")} since your last vote expired.**\n` +
    "**Your support means a lot to us — feel free to vote again to regain the role for another 24 hours!** :heart_hands:"
  );
};

// This file is exclusively for LukeZ' bots that use vote roles because it's so much stuff that would be needed to be generic otherwise

const voteRoles = [
  {
    key: "ticketon",
    id: "1440467925336064010",
    botId: "1415608381372371047",
  },
  {
    key: "supportmail",
    id: "1114933959365763132",
    botId: "1082707872565182614",
  },
  {
    key: "upvoteengine",
    id: "1440468021943734322",
    botId: "1435613778547834910",
  },
] as const;

export default async function loseVoteRole(
  oldMember: ClientEvents["guildMemberUpdate"][0],
  member: ClientEvents["guildMemberUpdate"][1]
) {
  const votesLost = new Array<(typeof voteRoles)[number]>();

  for (const voteRole of voteRoles) {
    const hadRole = oldMember.roles.cache.has(voteRole.id);
    const hasRole = member.roles.cache.has(voteRole.id);
    if (hadRole && !hasRole) {
      votesLost.push(voteRole);
    }
  }

  if (votesLost.length === 0) return;

  const dbUser = await DBUser.findOne({ id: member.id });
  if (!dbUser || dbUser.voteLooseDM === false) return;

  let command: ApplicationCommand<{
    guild: GuildResolvable;
  }>;
  if (!member.client.application.commands.cache.size) {
    await member.client.application.commands.fetch({
      force: true,
      cache: true,
    });
  }
  const foundCommand = member.client.application.commands.cache.find(
    (c) => c.name === "vote-notification"
  );

  if (!foundCommand) {
    Sentry.captureMessage("vote-notification command not found");
    return;
  }

  command = foundCommand;
  const container = new ContainerBuilder()
    .setAccentColor(Colors.Gold)
    .addTextDisplayComponents(
      (t) =>
        t.setContent(
          pm(
            member.id,
            votesLost.map((v) => v.botId)
          )
        ),
      (t) =>
        t.setContent(
          `-# <t:${dayjs().unix()}:s> | If you don't want to receive these DMs anymore, use </${
            command.name
          }:${command.id}>.`
        )
    );

  const ar = new ActionRowBuilder<ButtonBuilder>();
  for (const voteLost of votesLost) {
    ar.addComponents(botVoteBtns[voteLost.key]);
  }

  await member
    .send({
      flags: ComponentsV2Flags,
      components: [container, ar],
    })
    .catch(async () => {
      // Add member to "not send dms" list
      await DBUser.updateOne(
        { id: member.id },
        { voteLooseDM: false },
        { upsert: true }
      );
      Sentry.logger.debug(
        `Could not DM user ${member.id} about lost vote role.`
      );
    });
}
