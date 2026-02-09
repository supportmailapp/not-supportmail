import { DBUser } from "../models/user";
import cacheFactory from "./cacheFactory";

type SuggestSolveCacheEntry = {
  ownerId: string;
  setting: boolean;
};

const cache = cacheFactory<SuggestSolveCacheEntry>({
  stdTTL: 300,
  checkperiod: 60,
});

export default {
  set: (userId: string, data: SuggestSolveCacheEntry) =>
    cache.set(userId, data),
  /**
   * Gets the suggest solve setting for a user. If not in cache, fetches from DB and caches it.
   * @param userId The ID of the user to get the setting for
   * @returns An object containing the user ID and their suggest solve setting. Defaults to true if not set in DB.
   *
   * It is assumed that the userId is the owner id.
   */
  get: async (userId: string) => {
    const entry = cache.get(userId);
    if (entry) return entry;
    const dbUser = await DBUser.findOne(
      { id: userId },
      { suggestSolve: 1 },
      { lean: true },
    );
    const setting =
      typeof dbUser?.suggestSolve === "boolean" ? dbUser.suggestSolve : true;
    cache.set(userId, { ownerId: userId, setting });
    return { ownerId: userId, setting };
  },
  del: (userId: string) => cache.del(userId),
  take: (userId: string) => cache.take(userId) || null,
};
