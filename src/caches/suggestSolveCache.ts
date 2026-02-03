import { DBUser } from "../models/user";
import cacheFactory from "./cacheFactory";

const cache = cacheFactory<{ value: boolean }>({
  stdTTL: 300,
  checkperiod: 60,
});

export default {
  set: (userId: string, value: boolean) => cache.set(userId, { value }),
  get: async (userId: string) => {
    const entry = cache.get(userId);
    if (entry) return entry.value;
    const dbUser = await DBUser.findOne(
      { id: userId },
      { suggestSolve: 1 },
      { lean: true },
    );
    cache.set(userId, { value: dbUser ? dbUser.suggestSolve : true });
    return dbUser ? dbUser.suggestSolve : true;
  },
  del: (userId: string) => cache.del(userId),
  take: (userId: string) => cache.take(userId)?.value || null,
};
