import type { PublicThreadChannel } from "discord.js";
import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 1800,
  checkperiod: 120,
  errorOnMissing: false,
});

export type PartialMember = {
  id: string;
  displayName: string;
};

export function setThreadMembers(
  postId: string,
  partialMembers: PartialMember[]
) {
  cache.set<PartialMember[]>(postId, partialMembers);
}

export function getThreadMembers(postId: string) {
  return cache.get<PartialMember[]>(postId) ?? [];
}

export function takeThreadMembers(postId: string) {
  return cache.take<PartialMember[]>(postId) ?? [];
}

export async function fetchAndCacheThreadMembers(
  threadChannel: PublicThreadChannel,
  authorId: string,
  clientId: string,
  excludeIds: string[] = []
): Promise<PartialMember[]> {
  const allMembers = await threadChannel.members.fetch({
    withMember: true,
    cache: true,
  });

  const eligibleMembers = allMembers.filter(
    (member) =>
      member.id !== clientId &&
      member.id !== authorId &&
      !excludeIds.includes(member.id)
  );

  if (eligibleMembers.size > 0) {
    const partialMembers = eligibleMembers.map(
      ({ id, guildMember: member }) => ({
        id: id,
        displayName: member.displayName ?? member.user.displayName,
      })
    );
    setThreadMembers(threadChannel.id, partialMembers);
    return partialMembers;
  }

  return [];
}
