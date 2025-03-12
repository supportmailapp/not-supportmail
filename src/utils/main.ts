import { GuildMember } from "discord.js";

type ParsedCustomId = {
  compPath: string[];
  prefix: string;
  lastPathItem: string;
  component?: string;
  params?: string[];
  firstParam?: string | null;
  lastParam?: string | null;
};

// Overloads
export function parseCustomId(customId: string, onlyPrefix: true): string;
export function parseCustomId(
  customId: string,
  onlyPrefix?: false
): ParsedCustomId;

/**
 * Parses a custom ID string.
 *
 * The separator is `/`.
 */
export function parseCustomId(
  customId: string,
  onlyPrefix: boolean = false
): string | ParsedCustomId {
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
    component: pathParts[1] || null,
    params: params?.split("/") || [],
    firstParam: params?.split("/")[0] || null,
    lastParam: params?.split("/").pop() || null,
  };
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canUpdateSupportPost(member: GuildMember, authorId: string | null = null) {
  const canRolewise =
    member.roles.cache.hasAny(
      process.env.ROLE_THREAD_MANAGER,
      process.env.ROLE_DEVELOPER
    ) || (authorId && member.id == authorId);
  const canPermissionwise = member.permissions.has("ManageGuild");

  return canRolewise || canPermissionwise;
}

/**
 * 
 * @param userId The Discord Snowflake ID of the user
 * @param roleIds The Discord Snowflake IDs of the user's roles
 */
export function checkUserAccess(userId: string, roleIds: string[], blacklist: string[], whitelist: string[]) {
  const _userId = `u-${userId}`;
  const _roleIds = roleIds.map((id) => `r-${id}`);

  if (blacklist.length) {
    if (blacklist.includes(_userId)) return false;
    else if (blacklist.some((id) => _roleIds.includes(id))) return false;
    else return true;
  }

  if (whitelist.length) {
    if (whitelist.includes(_userId)) return true;
    else if (whitelist.some((id) => _roleIds.includes(id))) return true;
    else return false;
  }

  return true;
}