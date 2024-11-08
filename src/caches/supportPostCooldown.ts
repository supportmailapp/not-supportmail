import dayjs from "dayjs";
import NodeCache from "node-cache";

/** `{ userid: string (unix timestamp) }` */
let cooldownCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  errorOnMissing: false,
});

function set(userid: string) {
  cooldownCache.set(userid, dayjs().add(5, "minutes").unix().toFixed());
}

function get(userid: string): string {
  return cooldownCache.get(userid);
}

function del(userid: string) {
  cooldownCache.del(userid);
}

export default { set, get, del };
