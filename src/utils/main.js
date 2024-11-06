/**
 * @typedef {Object} ParsedCustomId
 * @property {string[]} compPath - An Array of the path items. The first item is the prefix.
 * @property {string} prefix - The first path item.
 * @property {string} lastPathItem - The last path item.
 * @property {string[]} params - The params of the custom id (After the `?` in the custom id).
 * @property {string | null} firstParam - The first param of the custom id.
 * @property {string | null} lastParam - The last param of the custom id.
 */

/**
 * Parses a custom ID string.
 *
 * The separator is `/`.
 *
 * @param {string} customId - The custom ID string to parse.
 * @param {boolean} [onlyPrefix=false] - Whether to return only the prefix or the full parsed object.
 * @returns {string | ParsedCustomId} Either the prefix string or an object with parsed components.
 */
export function parseCustomId(customId, onlyPrefix = false) {
  if (onlyPrefix) {
    return (
      customId.match(/^(?<prefix>.+?)(\/|\?)/i)?.groups?.prefix || customId
    );
  }

  const [path, params] = customId.split("?");
  const pathParts = path.split("/");

  return {
    compPath: pathParts,
    prefix: pathParts[0],
    lastPathItem: pathParts[pathParts.length - 1],
    params: params?.split("/") || [],
    firstParam: params?.split("/")[0] || null,
    lastParam: params?.split("/").pop() || null,
  };
}
