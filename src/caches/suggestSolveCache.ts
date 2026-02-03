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
    const value =
      typeof dbUser?.suggestSolve === "boolean" ? dbUser.suggestSolve : true;
    cache.set(userId, { value });
    return value;
  },
  del: (userId: string) => cache.del(userId),
  take: (userId: string) => cache.take(userId)?.value || null,
};
