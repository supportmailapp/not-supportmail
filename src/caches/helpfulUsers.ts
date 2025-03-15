import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 900,
  checkperiod: 120,
  errorOnMissing: false,
});

export function setUsers(postId: string, userIds: string[]) {
  cache.set<string[]>(postId, userIds);
}

export function getUsers(postId: string) {
  return cache.get<string[]>(postId) ?? [];
}

export function takeUsers(postId: string) {
  return cache.take<string[]>(postId) ?? [];
}
