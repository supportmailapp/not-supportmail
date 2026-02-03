import type { ClientEvents } from "discord.js";
import { AuditLogEvent, Collection } from "discord.js";
import joinRolesCache from "../../caches/joinRoles.js";

export async function joinRoleViewer(
  auditLogEntry: ClientEvents["guildAuditLogEntryCreate"][0],
  guild: ClientEvents["guildAuditLogEntryCreate"][1]
) {
  const { targetId: memberId, changes } = auditLogEntry;

  if (!memberId || auditLogEntry.action !== AuditLogEvent.MemberRoleUpdate)
    return;

  // Check if there's already a cache entry
  if (!joinRolesCache.has(guild.id, memberId)) {
    // No cache entry exists, abort
    return;
  }

  // Cache entry exists, check if all roles match
  const cachedRoles = joinRolesCache.get(guild.id, memberId);
  if (!cachedRoles) return;

  // Get the current roles from the changes
  const currentRoles = new Collection(
    changes
      .find((change) => change.key === "$add")
      ?.new?.map((r) => [r.id, r]) ?? []
  );

  // Check if all cached roles are in the current roles
  const allRolesMatch = currentRoles.hasAll(
    ...Array.from(cachedRoles.values())
  );

  if (allRolesMatch) {
    // All roles match, delete cache entry
    joinRolesCache.del(guild.id, memberId);
  } else {
    // Only some roles match, update cache with remaining roles
    const remainingRoles = cachedRoles.filter(
      (roleId) => !currentRoles.has(roleId)
    );
    if (remainingRoles.length > 0) {
      joinRolesCache.set(guild.id, memberId, remainingRoles);
    } else {
      joinRolesCache.del(guild.id, memberId);
    }
  }
}
