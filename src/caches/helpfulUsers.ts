import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 1800,
  checkperiod: 120,
  errorOnMissing: false,
});

type PartialMember = {
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
