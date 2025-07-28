import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 30,
  checkperiod: 15,
  errorOnMissing: false,
  useClones: false,
});

const buildKey = (guildId: string, memberId: string) =>
  `${guildId}:${memberId}` as const;

function setJoinsRoles(guildId: string, memberId: string, roles: string[]) {
  return cache.set<string[]>(buildKey(guildId, memberId), roles);
}

function getJoinRoles(guildId: string, memberId: string) {
  return cache.get<string[]>(buildKey(guildId, memberId));
}

function takeJoinRoles(guildId: string, memberId: string) {
  return cache.take<string[]>(buildKey(guildId, memberId));
}

function hasJoinRoles(guildId: string, memberId: string) {
  return cache.has(buildKey(guildId, memberId));
}

function delJoinRoles(guildId: string, memberId: string) {
  return cache.del(buildKey(guildId, memberId));
}

export default {
  set: setJoinsRoles,
  get: getJoinRoles,
  take: takeJoinRoles,
  has: hasJoinRoles,
  del: delJoinRoles,
};
