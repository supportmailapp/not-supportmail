import cacheFactory from "./cacheFactory";

type PostOwnershipCacheEntry = {
  ownerId: string;
};

// used for posts where post owner does not match the user who made the post (support posts created by a mod on behalf of a user)
const cache = cacheFactory<PostOwnershipCacheEntry>({
  stdTTL: 300,
  checkperiod: 60,
});

export default {
  set: (channelId: string, ownerId: string) =>
    cache.set(channelId, { ownerId }),
  get: (channelId: string) => {
    const entry = cache.get(channelId);
    return entry?.ownerId || null;
  },
  del: (channelId: string) => cache.del(channelId),
  take: (channelId: string) => cache.take(channelId)?.ownerId || null,
};
