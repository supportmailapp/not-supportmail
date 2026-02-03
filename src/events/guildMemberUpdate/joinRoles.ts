import * as Sentry from "@sentry/bun";
import { Collection, type ClientEvents } from "discord.js";
import joinRolesCache from "../../caches/joinRoles.js";
import config from "../../config.js";
import { delay } from "../../utils/main.js";

const joinRoles = new Collection(Object.entries(config.joinRoles));

export async function joinRolesUpdate(
  oldMember: ClientEvents["guildMemberUpdate"][0],
  member: ClientEvents["guildMemberUpdate"][1]
) {
  console.log.debug("guildMemberUpdate joinRoles event triggered", {
    userId: member.id,
    guildId: member.guild.id,
    oldPending: oldMember.pending,
    newPending: member.pending,
    isBot: member.user.bot,
  });

  if (!oldMember.pending || member.pending) {
    console.log.debug(
      "Member is still was not pending or is still pending, skipping join roles"
    );
    return;
  }

  // Determine if join roles should be applied based on cache
  await delay(2_000); // Wait for the audit log handler to finish first
  const shouldApplyJoinRoles = !joinRolesCache.has(member.guild.id, member.id);

  console.log.debug("Checked join roles cache", {
    userId: member.id,
    guildId: member.guild.id,
    shouldApplyJoinRoles,
  });

  if (!shouldApplyJoinRoles) {
    // Cache entry exists, abort
    console.log.debug("Cache entry exists, aborting join roles application");
    return;
  }

  // Check if join roles should be applied (missing roles)
  // Differentiate between bot (bot) and human (!bot) roles
  const isBot = member.user.bot;
  const rolesToApply = joinRoles.filter((role, rid) => {
    const hasRole = member.roles.cache.has(rid);
    if (hasRole) return false; // Skip if already has the role
    return isBot ? role.bot : !role.bot;
  });
  const roleIds = rolesToApply.map((_, id) => id);

  console.log.debug("Filtered roles to apply", {
    userId: member.id,
    isBot,
    rolesToApplyCount: rolesToApply.size,
    rolesToApplyIds: roleIds,
  });

  if (rolesToApply.size === 0) {
    console.log.debug("No roles to apply, returning");
    return;
  }

  // Store which roles should be applied in cache
  joinRolesCache.set(member.guild.id, member.id, roleIds);

  console.log.debug("Stored roles in cache", {
    userId: member.id,
    guildId: member.guild.id,
    roleIds,
  });

  // Wait 8 seconds
  await delay(8_000);

  // Check if user still exists in cache (might have been removed by audit log handler)
  if (!joinRolesCache.has(member.guild.id, member.id)) {
    // Cache was cleared by audit log handler, meaning Sapphire already applied roles
    console.log.debug(
      "Cache was cleared by audit log handler, Sapphire already applied roles"
    );
    return;
  }

  // Apply join roles from cache
  const rolesToApplyFromCache = joinRolesCache.take(member.guild.id, member.id);

  console.log.debug("Retrieved roles from cache", {
    userId: member.id,
    guildId: member.guild.id,
    rolesToApplyFromCache,
  });

  if (!rolesToApplyFromCache || rolesToApplyFromCache.length === 0) {
    console.log.debug("No roles to apply from cache, returning");
    return;
  }

  try {
    await member.roles.add(
      rolesToApplyFromCache,
      "Added join roles after member update"
    );

    console.log.debug("Successfully applied join roles", {
      userId: member.id,
      guildId: member.guild.id,
      appliedRoles: rolesToApplyFromCache,
    });
  } catch (error) {
    console.log.error("Failed to add join roles", {
      userId: member.id,
      rolesToAdd: rolesToApplyFromCache,
      error,
    });

    Sentry.captureMessage("Failed to add join roles", {
      level: "error",
      extra: {
        userId: member.id,
        rolesToAdd: rolesToApplyFromCache,
      },
    });
  }
}
