import cacheFactory from "./cacheFactory.js";

const cache = cacheFactory<{ lastReply: Date }>({
  stdTTL: 60,
  checkperiod: 15,
});

export default {
  set: (guildId: string, lastReply: Date) => cache.set(guildId, { lastReply }),
  get: (guildId: string) => cache.get(guildId),
  del: (guildId: string) => cache.del(guildId),
  take: (guildId: string) => cache.take(guildId),
};
