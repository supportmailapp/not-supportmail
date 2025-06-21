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
  bot: boolean;
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

/**
 * Fetches all members from a thread channel and caches eligible members excluding specified IDs.
 *
 * @param threadChannel - The public thread channel to fetch members from
 * @param authorId - The ID of the thread author to exclude from results
 * @param clientId - The ID of the bot client to exclude from results
 * @param excludeIds - Optional array of additional user IDs to exclude from results
 * @returns Promise that resolves to an array of partial member objects containing id, displayName, and bot status
 *
 * @remarks
 * This function fetches thread members with full guild member data, filters out the client bot,
 * thread author, and any additional excluded IDs, then maps the results to a simplified format
 * before caching and returning them. Returns an empty array if no eligible members are found.
 */
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
        bot: member.user.bot,
      })
    );
    setThreadMembers(threadChannel.id, partialMembers);
    return partialMembers;
  }

  return [];
}
