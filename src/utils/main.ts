import {
  ActionRowBuilder,
  APIEmbed,
  Client,
  GuildMember,
  PublicThreadChannel,
  SlashCommandStringOption,
  StringSelectMenuBuilder,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { HydratedDocument } from "mongoose";
import type { PartialMember } from "../caches/helpfulUsers.js";
import config from "../config.js";
import { ISupportPost, SupportPost } from "../models/supportPost.js";
import { DBUser } from "../models/user.js";

type ParsedCustomId = {
  compPath: string[];
  prefix: string;
  lastPathItem: string;
  component: string | null;
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

/**
 * Determines if a guild member can update a support post based on their roles and permissions.
 *
 * @param member - The guild member to check permissions for
 * @param authorId - Optional ID of the original post author. If provided and matches the member's ID, grants update permission
 * @returns True if the member can update the support post, false otherwise
 *
 * @remarks
 * A member can update a support post if they meet any of the following criteria:
 * - Have the THREAD_MANAGER or DEVELOPER role
 * - Are the original author of the post (when authorId is provided)
 * - Have the "ManageGuild" permission
 */
export function canUpdateSupportPost(
  member: GuildMember,
  authorId: string | null = null
) {
  const canRolewise =
    member.roles.cache.hasAny(
      process.env.ROLE_THREAD_MANAGER!,
      process.env.ROLE_DEVELOPER!
    ) ||
    (authorId && member.id == authorId);
  const canPermissionwise = member.permissions.has("ManageGuild");

  return canRolewise || canPermissionwise;
}

/**
 *
 * @param userId The Discord Snowflake ID of the user
 * @param roleIds The Discord Snowflake IDs of the user's roles
 */
export function checkUserAccess(
  userId: string,
  roleIds: string[],
  blacklist: string[],
  whitelist: string[]
) {
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

/**
 * Updates the username of a user in the database.
 */
export async function updateDBUsername(
  user: { id: string; username: string; displayName?: string },
  checkForExistence = false
) {
  let updateQuery = { username: user.username } as any;
  if (user.displayName) updateQuery["displayName"] = user.displayName;
  if (checkForExistence) {
    const userExists = await DBUser.exists({ id: user.id });
    if (!userExists) {
      await DBUser.create({
        id: user.id,
        ...updateQuery,
      });
      return;
    }
  }

  await DBUser.updateOne({ id: user.id }, updateQuery);
  return;
}

export function buildHelpfulResponse(postId: string, members: PartialMember[]) {
  const embed = {
    author: { name: "Optional" },
    title: "Select the user(s) who helped you the most.",
    description: "-# This will help us to reward the most helpful users.",
    color: 0x2b2d31,
  } as APIEmbed;
  if (members.length > 25) {
    embed["footer"] = {
      text: "Showing the first 25 users. More users can not be shown right now.",
    };
  }
  const chunkedMembers = members.slice(0, 25);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>({
        components: [
          new StringSelectMenuBuilder({
            customId: "helpful?" + postId,
            maxValues: chunkedMembers.length,
          }).setOptions(
            chunkedMembers.map((members) => ({
              label: members.displayName,
              value: members.id,
            }))
          ),
        ],
      }),
    ],
  };
}

/**
 * Creates a slash command string option for priority selection.
 *
 * @param required - Whether the priority option is required. Defaults to false.
 * @returns A SlashCommandStringOption configured with priority choices (P0-High, P1-Medium, P2-Low)
 */
export const PriorityOption = (required = false) => {
  return new SlashCommandStringOption()
    .setName("priority")
    .setDescription("Priority of the support question")
    .setRequired(required)
    .addChoices(
      { name: "P0 (High)", value: "P0" },
      { name: "P1 (Medium)", value: "P1" },
      { name: "P2 (Low)", value: "P2" }
    );
};

/**
 * Sets the priority level for a support post and optionally updates the associated Discord channel.
 *
 * @param post - The hydrated support post document to update
 * @param priority - The priority level to set for the support post
 * @param channel - Optional Discord thread channel to update with priority tags
 * @returns Promise that resolves to the tag ID for the set priority level
 * @throws {Error} When an invalid priority level is provided or updating the channel fails
 */
export async function setPostPriority(
  post: HydratedDocument<ISupportPost>,
  priority: PriorityLevel,
  channel?: PublicThreadChannel
) {
  const tagId = config.priorityTags[priority];
  if (!tagId) {
    throw new Error(`Invalid priority level: ${priority} (HOW???)`);
  }

  await SupportPost.updateOne({ id: post.id }, { priority: priority });

  if (channel) {
    const tags = [
      ...filterExternalPostTags(channel.appliedTags, "priority"),
      tagId,
    ];
    await channel.edit({
      appliedTags: tags,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    });
    return tagId;
  }
  return tagId;
}

/**
 * Retrieves a Discord command mention string for the specified command name.
 *
 * @param commandName - The name of the command to get a mention for. Can include subcommands separated by spaces.
 * @param client - The Discord client instance used to fetch command information.
 * @returns A promise that resolves to a formatted command mention string. Returns a clickable mention format `</${commandName}:${id}>` if the command is found, otherwise returns a code-formatted string `\`/${commandName}\``.
 *
 * @example
 * ```typescript
 * const mention = await getCommandMention("help", client);
 * // Returns: "</help:123456789>" or "`/help`"
 *
 * const subcommandMention = await getCommandMention("user ban", client);
 * // Returns: "</user ban:987654321>" or "`/user ban`"
 * ```
 */
export async function getCommandMention(commandName: string, client: Client) {
  const baseName = commandName.split(" ")[0];
  let cmd = client.application?.commands.cache.find((c) => c.name === baseName);

  if (!cmd) {
    const cmds = await client.application?.commands.fetch();
    cmd = cmds?.find((c) => c.name === baseName);
  }

  return cmd ? `</${commandName}:${cmd.id}>` : `\`/${commandName}\``;
}

/**
 * List of internal tag IDs that are used by the system.
 */
export const InternalTags = Object.values(config.tags).concat(
  Object.values(config.priorityTags)
);

/**
 * Filters out internal tags from an array of applied tags based on the specified type.
 *
 * @param appliedTags - Array of tag strings to filter
 * @param type - Type of filtering to apply:
 *   - "priority": Filters out priority tags from `config.priorityTags`
 *   - "support": Filters out support tags from `config.tags`
 *   - "all": Filters out all internal tags from `InternalTags` array
 * @returns Filtered array of tags with internal tags removed
 *
 * @remarks
 * This function is useful for ensuring that external tags are preserved while internal tags are removed.
 */
export function filterExternalPostTags(
  appliedTags: string[],
  type: "support" | "priority" | "all" = "all"
) {
  if (type === "priority") {
    return appliedTags.filter(
      (tag) => !Object.values(config.priorityTags).includes(tag)
    );
  } else if (type === "support") {
    return appliedTags.filter(
      (tag) => !Object.values(config.tags).includes(tag)
    );
  } else {
    return appliedTags.filter((tag) => !InternalTags.includes(tag));
  }
}
