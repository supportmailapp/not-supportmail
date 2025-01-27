import NodeCache from "node-cache";

// Since we archive it again by ourself, we need to cache which post has already been processed to abort on a second execution to be sure the database model was updated.
const postCache = new NodeCache({ stdTTL: 15, checkperiod: 5, errorOnMissing: false });

function set(postid: string) {
  postCache.set(postid, Date.now());
}

function get(postid: string): string | undefined {
  return postCache.get(postid);
}

function take(postid: string): string | undefined {
  return postCache.take(postid);
}

function del(postid: string) {
  postCache.del(postid);
}

export default { set, get, take, del };
