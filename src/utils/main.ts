import {
  ActionRowBuilder,
  APIEmbed,
  ButtonBuilder,
  Client,
  Colors,
  ContainerBuilder,
  GuildMember,
  MessageCreateOptions,
  StringSelectMenuBuilder,
} from "discord.js";
import type { PartialMember } from "../caches/helpfulUsers.js";
import { DBUser } from "../models/user.js";
import { ComponentsV2Flags } from "./enums.js";

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

export const botVoteBtns = {
  ticketon: new ButtonBuilder({
    style: 5,
    label: "Vote for Ticketon",
    url: "https://top.gg/bot/1415608381372371047/vote",
    emoji: {
      id: "1440465809846829177",
      name: "ticketon",
    },
  }),
  supportmail: new ButtonBuilder({
    style: 5,
    label: "Vote for SupportMail",
    url: "https://top.gg/bot/1082707872565182614/vote",
    emoji: {
      id: "1248944135654739988",
      name: "supportmail",
    },
  }),
  upvoteengine: new ButtonBuilder({
    style: 5,
    label: "Vote for UpvoteEngine",
    url: "https://top.gg/bot/1435613778547834910/vote",
    emoji: {
      id: "1440466098624532705",
      name: "upvote_engine",
    },
  }),
};

/**
 * Attempts to parse a string as an integer with validation and clamping.
 *
 * @param str - The string to parse as an integer
 * @param _defaultValue - The value to return if parsing fails or validation fails
 * @param max - The maximum allowed value (inclusive)
 * @param min - The minimum allowed value (inclusive), defaults to 1
 * @returns The parsed integer clamped to the range [min, max], or the default value if parsing fails
 *
 * @example
 * ```typescript
 * tryToParseInt("42", 0, 100, 1); // Returns 42
 * tryToParseInt("150", 0, 100, 1); // Returns 100 (clamped to max)
 * tryToParseInt("abc", 0, 100, 1); // Returns 0 (default value)
 * tryToParseInt("0", 10, 100, 1); // Returns 1 (clamped to min)
 * tryToParseInt("xyz", 2, 100, 1); // Returns 2 (default value, whitespace input)
 * ```
 */
export function safeParseInt(
  str: unknown,
  _defaultValue: number,
  min = 1,
  max?: number
): number {
  try {
    if (typeof str !== "string") {
      return _defaultValue; // Return default value if input is not a string
    }
    const num = parseInt(str, 10); // Always specify radix

    // Check if parsing failed or string wasn't purely numeric
    if (isNaN(num) || !str.trim() || !/^\d+$/.test(str.trim())) {
      return _defaultValue;
    }

    // Clamp the value to the range [min, max] (if max is provided)
    return Math.max(min, max !== undefined ? Math.min(max, num) : num);
  } catch {
    return _defaultValue;
  }
}

export const voteMessage: MessageCreateOptions = {
  flags: ComponentsV2Flags,
  components: [
    new ContainerBuilder()
      .setAccentColor(0x0099ff)
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            "### Vote Rewards!",
            "You can vote on top.gg every 12 hours for each bot. Follow the links below.",
            "- You gain the Vote-Reward-Role for 24 hours every time you vote.",
          ].join("\n")
        )
      ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      Object.values(botVoteBtns)
    ),
  ],
};

export function randomColor() {
  const values = Object.values(Colors).filter(
    (v) => typeof v === "number"
  ) as number[];
  return values[Math.floor(Math.random() * values.length)]!;
}
