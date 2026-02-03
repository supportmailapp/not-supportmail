import * as Sentry from "@sentry/bun";
import {
  type APIMessageTopLevelComponent,
  ChannelType,
  Colors,
  ContainerBuilder,
  Guild,
  type JSONEncodable,
  type OverwriteData,
  TextDisplayBuilder,
  VoiceChannel,
} from "discord.js";
import type { HydratedDocument } from "mongoose";
import {
  type ITempChannelCategory,
  TempChannel,
} from "../models/tempChannel.js";
import { EphemeralV2Flags } from "./enums.js";

type LastChannelDataSuccess = {
  success: true;
  overwrites: OverwriteData[];
  channel: VoiceChannel;
};
type LastChannelDataError = {
  success: false;
  error: string;
};

export async function fetchLastChannelData(
  guild: Guild,
  categoryId: string,
): Promise<LastChannelDataSuccess | LastChannelDataError> {
  const lastTempChannel = await TempChannel.findOne(
    {
      guildId: guild.id,
      category: categoryId,
    },
    "channelId",
    { sort: { createdAt: -1 } },
  );
  if (!lastTempChannel) {
    return { success: false, error: "Last channel not found in database" };
  }

  const lastDCChannel = (await guild.channels
    .fetch(lastTempChannel.channelId)
    .catch((e) => {
      Sentry.captureException(e);
      return null;
    })) as VoiceChannel | null;

  if (!lastDCChannel) {
    return {
      success: false,
      error: "Failed to fetch last channel (maybe it was deleted...)",
    };
  }

  return {
    success: true,
    overwrites: lastDCChannel.permissionOverwrites.cache.map((overwrite) => {
      return {
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield,
      };
    }),
    channel: lastDCChannel,
  };
}

async function getNextChannelNumber(
  guildId: string,
  categoryId: string,
): Promise<number> {
  // Get all existing channel numbers in this category
  const existingChannels = await TempChannel.find(
    {
      guildId,
      category: categoryId,
    },
    "number",
    { sort: { number: 1 } }, // Sort by number ascending
  );

  // Extract used numbers from the database
  const usedNumbers = new Set<number>();

  for (const channel of existingChannels) {
    if (channel.number) {
      usedNumbers.add(channel.number);
    }
  }

  // Find the next available number
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  return nextNumber;
}

type CreateAndSaveTempChannelSuccess = {
  success: true;
  channel: VoiceChannel;
};
type CreateAndSaveTempChannelError = {
  success: false;
  error: string;
};

export async function createAndSaveTempChannel(
  guild: Guild,
  tCategory: HydratedDocument<ITempChannelCategory>,
  parentId: string | null = null,
  withOverwrites: boolean = false,
): Promise<CreateAndSaveTempChannelSuccess | CreateAndSaveTempChannelError> {
  let lastChannelData: LastChannelDataSuccess | LastChannelDataError | null =
    null;
  if (withOverwrites) {
    lastChannelData = await fetchLastChannelData(guild, tCategory.id);
    console.trace(
      "Fetched old channel data for new temp channel creation",
      { ...lastChannelData },
    );
    if (!lastChannelData.success) {
      Sentry.captureMessage(lastChannelData.error);
      return {
        success: false,
        error: "Failed to fetch last channel data: " + lastChannelData.error,
      };
    }
  }

  const nextChannelNumber = await getNextChannelNumber(guild.id, tCategory.id);
  const channelName = tCategory.namingScheme.replace(
    "{number}",
    String(nextChannelNumber),
  );

  let channel: VoiceChannel | null = null;
  if (lastChannelData?.success) {
    channel = await lastChannelData.channel
      .clone({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: parentId,
        userLimit: tCategory.maxUsersPerChannel || undefined,
      })
      .catch((err) => {
        Sentry.captureException(err);
        return null;
      });
  } else {
    channel = await guild.channels
      .create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: parentId,
        userLimit: tCategory.maxUsersPerChannel || undefined,
      })
      .catch((err) => {
        Sentry.captureException(err);
        return null;
      });
  }

  if (!channel) {
    return {
      success: false,
      error: "Channel Creation failed. Please check your Sentry errors.",
    };
  }

  console.trace(
    `Created new temp channel (${channel.id}) with position ${channel.position}.`,
  );

  if (
    lastChannelData?.channel.position !== undefined &&
    channel.position !== lastChannelData?.channel.position
  ) {
    console.warn(
      `Channel position mismatch: Expected ${lastChannelData.channel.position}, got ${channel.position}. Adjusting...`,
    );
    await channel
      .setPosition(lastChannelData.channel.position + 1, {
        reason: "Set position to match last channel",
        relative: false,
      })
      .catch((err) => {
        const errId = Sentry.captureException(err);
        console.error("Failed to set channel position after creation", {
          errorId: errId,
        });
      });
  }

  await TempChannel.create({
    guildId: guild.id,
    channelId: channel.id,
    category: tCategory._id,
    userCount: 0,
    number: nextChannelNumber,
  });

  return {
    success: true,
    channel: channel,
  };
}

export type EditAction =
  | "name"
  | "parent"
  | "namingScheme"
  | "maxUsersPerChannel"
  | "maxTempChannels";

/**
 * Builds a custom ID string for Discord components related to temporary channel categories.
 *
 * @param component - The type of component, either "edit" or "info"
 * @param categoryId - The ID of the category to include in the custom ID
 * @param action - Optional edit action to include in the custom ID
 * @param asLocal - Whether to use a local prefix ("~") instead of the full prefix ("tempChannelCategory")
 * @returns A formatted custom ID string with the specified parameters
 *
 * @example
 * ```typescript
 * // Returns "tempChannelCategory/edit/rename?123456"
 * buildCustomId("edit", "123456", "rename");
 *
 * // Returns "~/info?123456"
 * buildCustomId("info", "123456", null, true);
 * ```
 *
 * @remarks
 * This function is used to create custom IDs for Discord components that can be used in interactions.
 * Local prefix is used for local components, which are handled with `awaitMessageComponent` / `awaitModalSubmit` directly after sending the reply instead of using a new interaction handler.
 */
export function buildCustomId(
  component: "edit" | "info",
  categoryId: string,
  action: EditAction | null = null,
) {
  const prefix = `tempChannelCategory/${component}` as const;
  if (action) return `${prefix}/${action}?${categoryId}` as const;
  else return `${prefix}?${categoryId}` as const;
}

export function ErrorResponse(content: string): {
  flags: typeof EphemeralV2Flags;
  components: JSONEncodable<APIMessageTopLevelComponent>[];
} {
  return {
    flags: EphemeralV2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Red)
        .addTextDisplayComponents((t) => t.setContent(content)),
    ],
  } as const;
}

export function SuccessContainer(): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(Colors.Green);
}

export function buildCategoryInfo(
  cat: HydratedDocument<ITempChannelCategory>,
  withContainer?: false,
  color?: number,
): TextDisplayBuilder[];
export function buildCategoryInfo(
  cat: HydratedDocument<ITempChannelCategory>,
  withContainer: true,
  color?: number,
): ContainerBuilder;
/**
 * Builds the category information display.
 * @param cat The category document.
 * @param withContainer Whether to include a container.
 * @param color The color of the container
 * @param withButtons Whether to include action buttons. **Only works if `withContainer` is true - otherwise omitted!**
 */
export function buildCategoryInfo(
  cat: HydratedDocument<ITempChannelCategory>,
  withContainer: boolean = false,
  color: number = Colors.Blue,
) {
  const infoContent: Record<EditAction, string> = {
    name: `- **Category Name:** ${cat.name}\n-# - **Category ID:** ${cat.id}`,
    parent: `- **Parent Category ID:** ${
      cat.parentId
        ? `https://discord.com/channels/${cat.guildId}/${cat.parentId}`
        : "None"
    }`,
    namingScheme: `- **Channel Naming Scheme:** \`${cat.namingScheme}\``,
    maxUsersPerChannel: `- **Max Users Per Channel:** ${
      Boolean(cat.maxUsersPerChannel)
        ? "`" + cat.maxUsersPerChannel + "`"
        : "No Limit"
    }`,
    maxTempChannels: `- **Max Temp Channels:** \`${cat.maxChannels}\``,
  };

  const textDisplays: TextDisplayBuilder[] = [
    new TextDisplayBuilder().setContent(Object.values(infoContent).join("\n")),
  ];
  if (withContainer) {
    return new ContainerBuilder()
      .setAccentColor(color)
      .addTextDisplayComponents(...textDisplays);
  }
  return textDisplays;
}

/**
 * Deletes temporary channels within a specified category in a guild and removes their records from the database.
 *
 * @param guild - The Discord guild where the temporary channels are located.
 * @param categoryId - The ID of the category containing the temporary channels to be deleted.
 * @returns A promise that resolves to the number of Discord Channels successfully deleted.
 */
export async function deleteTempChannels(
  guild: Guild,
  categoryId: string,
): Promise<number> {
  const tempChannels = await TempChannel.find({
    guildId: guild.id,
    category: categoryId,
  });

  let deletedCount = 0;
  for (const tChannel of tempChannels) {
    await guild.channels
      .delete(tChannel.channelId)
      .then(() => deletedCount++)
      .catch(() => {});
  }

  await TempChannel.deleteMany({
    guildId: guild.id,
    category: categoryId,
  });

  return deletedCount;
}
