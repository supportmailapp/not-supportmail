import { scheduleJob } from "node-schedule";
import config from "../config.js";
import { APIGuildMember, REST } from "discord.js";
import { Subscription } from "../models/subscription.js";
import { delay } from "../utils/main.js";

async function getGuildMembersPage(
  rest: REST,
  guildId: string,
  after: string = "0"
) {
  const members = (await rest.get(`/guilds/${guildId}/members`, {
    body: {
      limit: 1000,
      after: after,
    },
  })) as APIGuildMember[];

  // use recursion to get all members
  if (members.length == 1000) {
    await delay(1000);
    const nextMembers = await getGuildMembersPage(
      rest,
      guildId,
      members[members.length - 1].user.id
    );
    return members.concat(nextMembers);
  }

  return members;
}

export default class CheckSubs {
  public static async start() {
    scheduleJob("0 0 * * *", this.execute);
  }

  public static async execute() {
    const rest = new REST({ version: "10" }).setToken(config.botToken);

    const members = await getGuildMembersPage(rest, config.guildId);

    let membersToCheck: APIGuildMember[] = [];
    for (const member of members) {
      if (member.roles.includes(config.subRoleId)) membersToCheck.push(member);
    }

    const subs = await Subscription.find({
      userId: { $in: membersToCheck.map((m) => m.user.id) },
    });

    if (subs.length == membersToCheck.length) return;

    for (const member of membersToCheck) {
      const sub = subs.find((s) => s.userId == member.user.id);
      if (sub.cancelledAt == null) continue;

      await rest.patch(`/guilds/${config.guildId}/members/${member.user.id}`, {
        body: {
          roles: member.roles.filter((r) => r != config.subRoleId),
        },
      });
      await delay(1000);
    }
  }
}
