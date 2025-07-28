import * as Sentry from "@sentry/node";
import type { ClientEvents } from "discord.js";
import joinRolesCache from "../../caches/joinRoles.js";
import config from "../../config.js";
import { delay } from "../../utils/main.js";

const joinRoles = new Map(Object.entries(config.joinRoles));

export default async function (
  oldMember: ClientEvents["guildMemberUpdate"][0],
  member: ClientEvents["guildMemberUpdate"][1]
) {
  if (oldMember.roles.cache.size === member.roles.cache.size) return;

  const addedRoleIds = member.roles.cache
    .filter((role) => !oldMember.roles.cache.has(role.id))
    .map((role) => role.id);
  const removedRoles = oldMember.roles.cache
    .filter((role) => !member.roles.cache.has(role.id))
    .map((role) => role.id);

  if (addedRoleIds.length === 0 && removedRoles.length === 0) return;

  // Determine if join roles should be applied based on cache
  await delay(2_000); // Wait for the audit log handler to finish first
  const shouldApplyJoinRoles = !joinRolesCache.has(member.guild.id, member.id);

  if (!shouldApplyJoinRoles) {
    // Cache entry exists, abort
    return;
  }

  // Check if join roles should be applied (missing roles)
  // Differentiate between bot (bot) and human (!bot) roles
  const isBot = member.user.bot;
  const rolesToApply = addedRoleIds.filter((roleId) => {
    const jr = joinRoles.get(roleId);
    if (!jr) return false; // Skip if role config doesn't exist

    return isBot ? jr.bot : !jr.bot;
  });
  if (rolesToApply.length === 0) return;

  // Store which roles should be applied in cache
  joinRolesCache.set(member.guild.id, member.id, rolesToApply);

  // Wait 8 seconds
  await delay(8_000);

  // Check if user still exists in cache (might have been removed by audit log handler)
  if (!joinRolesCache.has(member.guild.id, member.id)) {
    // Cache was cleared by audit log handler, meaning Sapphire already applied roles
    return;
  }

  // Apply join roles from cache
  const rolesToApplyFromCache = joinRolesCache.take(member.guild.id, member.id);
  if (!rolesToApplyFromCache || rolesToApplyFromCache.length === 0) return;

  try {
    await member.roles.add(
      rolesToApplyFromCache,
      "Added join roles after member update"
    );
  } catch (error) {
    Sentry.captureMessage("Failed to add join roles", {
      level: "error",
      extra: {
        userId: member.id,
        rolesToAdd: rolesToApplyFromCache,
      },
    });
  }
}
