import NodeCache from "node-cache";

// Since we archive it again by ourself, we need to cache which post has already been processed to abort on a second execution to be sure the database model was updated.
const postCache = new NodeCache({
  stdTTL: 15,
  checkperiod: 5,
  errorOnMissing: false,
});

function set(postid: string) {
  postCache.set(postid, Date.now());
}

function get(postid: string): string | undefined {
  return postCache.get(postid);
}

/**
 * Caches the post id to prevent double processing.
 *
 * Every time something is set in the cache, it's assumed that the action was already performed by the client.
 */
export default { set, get };
