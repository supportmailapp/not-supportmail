import {
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  Guild,
  SectionBuilder,
  SlashCommandBuilder,
  SlashCommandChannelOption,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  TextDisplayBuilder,
} from "discord.js";
import {
  ITempChannelCategory,
  TempChannel,
  TempChannelCategory,
} from "../models/tempChannel.js";
import { EphemeralComponentsV2Flags, EphemeralFlags } from "../utils/enums.js";
import {
  buildCategoryInfo,
  createAndSaveTempChannel,
  ErrorResponse,
  SuccessContainer,
} from "../utils/tempChannels.js";

type CachedCommandInteraction = ChatInputCommandInteraction<"cached">;

const categoryNameOption = (description: string, required = true) =>
  new SlashCommandStringOption()
    .setName("category")
    .setDescription(description)
    .setRequired(required)
    .setMinLength(3)
    .setMaxLength(100)
    .setAutocomplete(true);

const parentCategoryOption = () =>
  new SlashCommandChannelOption()
    .setName("parent")
    .setDescription(
      "The parent category for the temporary channel | Default: None (Root of the guild)"
    )
    .addChannelTypes(ChannelType.GuildCategory)
    .setRequired(false);

const maxChannelsOption = (required = false) =>
  new SlashCommandIntegerOption()
    .setName("max-channels")
    .setDescription(
      "The maximum number of channels that can be created for this category | Default: 10"
    )
    .setMinValue(1)
    .setMaxValue(100)
    .setRequired(required);

const maxMembersOption = (required = false) =>
  new SlashCommandIntegerOption()
    .setName("max-members")
    .setDescription(
      "The maximum number of members allowed in each channel | Default: unlimited"
    )
    .setMinValue(1)
    .setMaxValue(99)
    .setRequired(required);

const namingOption = (required = false) =>
  new SlashCommandStringOption()
    .setName("naming")
    .setDescription(
      "The naming schema for the channels | Available Vars: {number}"
    )
    .setMinLength(3)
    .setMaxLength(100)
    .setRequired(required);

const data = new SlashCommandBuilder()
  .setName("tempchannel")
  .setDescription("Manage temporary voice channels")
  .setDefaultMemberPermissions(32)
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a temporary voice channel")
      .addStringOption((op) =>
        op
          .setName("name")
          .setDescription("The name of the temporary voice category")
          .setMinLength(3)
          .setMaxLength(100)
          .setRequired(true)
      )
      .addStringOption(namingOption(true))
      .addIntegerOption(maxChannelsOption(false))
      .addIntegerOption(maxMembersOption(false))
      .addChannelOption(parentCategoryOption())
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a temp voice category")
      .addStringOption(
        categoryNameOption(
          "The category to delete | This will delete all current channels for the category as well"
        )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List all temporary voice categories")
      .addStringOption(
        categoryNameOption(
          "If provided, lists all channels for this category instead",
          false
        )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("Get information about a temporary voice category")
      .addStringOption(
        categoryNameOption("The category to get information about")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit a temporary voice category")
      .addStringOption(categoryNameOption("The category to edit", true))
      .addStringOption((op) =>
        op
          .setName("name")
          .setDescription("The name of the temporary voice category")
          .setMinLength(3)
          .setMaxLength(100)
          .setRequired(false)
      )
      .addStringOption(namingOption(false))
      .addIntegerOption(maxChannelsOption(false))
      .addIntegerOption(maxMembersOption(false))
      .addChannelOption(parentCategoryOption())
  );

async function run(ctx: CachedCommandInteraction) {
  const sub = ctx.options.getSubcommand(true);

  switch (sub) {
    case "create":
      await createCategory(ctx);
      break;
    case "delete":
      await deleteCategory(ctx);
      break;
    case "edit":
      await editCategory(ctx);
      break;
    case "list":
      await listCategoriesOrChannels(ctx);
      break;
    case "info":
      await listCategoryChannels(ctx);
      break;
    case "rename":
      await listCategories(ctx);
      break;
    default:
      await ctx.reply({
        components: [
          new TextDisplayBuilder().setContent(
            "How did you even get here? This command does not exist!"
          ),
        ],
        flags: EphemeralComponentsV2Flags,
      });
      return;
  }
}

async function getCategoryChoices(
  guildId: string,
  value: string = "",
  limit: number = 25
): Promise<ApplicationCommandOptionChoiceData[]> {
  const categories = await TempChannelCategory.find(
    {
      guildId: guildId,
      name: { $regex: value, $options: "i" },
    },
    null,
    { limit: limit, sort: { name: 1 } }
  );

  if (!categories || categories.length === 0) {
    return [
      {
        name: "No categories found",
        value: "%none%",
      },
    ];
  }

  return categories.map((cat) => {
    return {
      name: cat.name,
      value: cat.id,
    };
  });
}

async function autocomplete(ctx: AutocompleteInteraction<"cached">) {
  const sub = ctx.options.getSubcommand(true);
  const option = ctx.options.getFocused(true);

  if (sub === "create" || option.name !== "category") return;

  const choices = await getCategoryChoices(ctx.guildId);
  await ctx.respond(choices);
  return;
}

/**
 * Creates a temporary voice channel category.
 *
 * 1. Validates the name (for it not being `%none%` bcause that is a special reserved value).
 * 2. Checks if the category name already exists.
 * 3. Creates the category in the database.
 * 4. Creates the channel in Discord using the provided naming scheme (optionally with a parent category).
 */
async function createCategory(ctx: CachedCommandInteraction): Promise<void> {
  const options = {
    name: ctx.options.getString("name", true),
    naming: ctx.options.getString("naming", true),
    maxChannels: ctx.options.getInteger("max-channels") ?? 10,
    maxMembers: ctx.options.getInteger("max-members") ?? undefined,
    parent: ctx.options.getChannel("parent", false, [
      ChannelType.GuildCategory,
    ]),
  };

  if (options.name === "%none%") {
    await ctx.reply(
      ErrorResponse("The name `%none%` is reserved and cannot be used.")
    );
    return;
  }

  const existingCategory = await TempChannelCategory.findOne({
    guildId: ctx.guildId,
    name: options.name,
  });
  if (existingCategory) {
    await ctx.reply(
      ErrorResponse(
        `A category with the name \`${options.name}\` already exists.`
      )
    );
    return;
  }

  await ctx.deferReply({ flags: EphemeralFlags });

  const newCategory = await TempChannelCategory.create({
    guildId: ctx.guildId,
    name: options.name,
    namingScheme: options.naming,
    maxChannels: options.maxChannels,
    maxUsersPerChannel: options.maxMembers,
    parentId: options.parent?.id,
  });

  const createRes = await createAndSaveTempChannel(
    ctx.guild,
    newCategory,
    options.parent?.id,
    false
  );

  if (!createRes.success) {
    await ctx.editReply(ErrorResponse(createRes.error));
    return;
  }

  const container = buildCategoryInfo(newCategory, true, Colors.Green, true);
  console.log(container.toJSON());

  await ctx.editReply({
    components: [
      SuccessContainer().addTextDisplayComponents(
        (t) =>
          t.setContent(
            `Temporary voice channel category \`${newCategory.name}\` created successfully!`
          ),
        (t) => t.setContent(`> First temp channel: ${createRes.channel.url}`)
      ),
      container,
    ],
  });
}

/**
 * Deletes temporary channels within a specified category in a guild and removes their records from the database.
 *
 * @param guild - The Discord guild where the temporary channels are located.
 * @param categoryId - The ID of the category containing the temporary channels to be deleted.
 * @returns A promise that resolves to the number of Discord Channels successfully deleted.
 */
async function deleteTempChannels(
  guild: Guild,
  categoryId: string
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

/**
 * Deletes a temporary voice channel category and all associated channels.
 *
 * 1. Validates the provided category ID parameter
 * 2. Checks if the category exists in the db for the current guild
 * 3. Deletes all temporary channels associated with the category
 * 4. Removes the category from the database
 *
 * If the category ID is "%none%" or the category doesn't exist, an error response is sent instead.
 */
async function deleteCategory(ctx: CachedCommandInteraction): Promise<void> {
  const categoryId = ctx.options.getString("category", true);

  if (categoryId === "%none%") {
    await ctx.reply(
      ErrorResponse("You must specify a valid category to delete.")
    );
    return;
  }

  const category = await TempChannelCategory.findOne({
    guildId: ctx.guildId,
    _id: categoryId,
  });

  if (!category) {
    await ctx.reply(ErrorResponse("The specified category does not exist."));
    return;
  }

  const deletedCount = await deleteTempChannels(ctx.guild, categoryId);

  await TempChannelCategory.deleteOne({
    guildId: ctx.guildId,
    _id: categoryId,
  });

  await ctx.reply({
    flags: EphemeralComponentsV2Flags,
    components: [
      SuccessContainer().addTextDisplayComponents(
        (t) =>
          t.setContent(
            `Temporary voice channel category \`${category.name}\` deleted successfully!`
          ),
        (t) =>
          t.setContent(
            `> Deleted ${deletedCount} channel${deletedCount === 1 ? "" : "s"}.`
          )
      ),
    ],
  });
}

/**
 * Edits an existing temporary channel category configuration based on user input.
 *
 * 1. Validates that a valid category ID is provided (not "%none%")
 * 2. Checks if the specified category exists in the database
 * 3. Only updates fields that have defined values to avoid overwriting with undefined
 * 4. Remove all current channels from the category and create a new one with the updated parameters
 * 5. Responds with success message showing updated parameters and category information
 * 6. Uses ephemeral replies to keep responses private to the command user
 *
 * Will send error response if category ID is invalid, category doesn't exist, or update fails
 */
async function editCategory(ctx: CachedCommandInteraction): Promise<void> {
  const options: Partial<ITempChannelCategory> & { id: string } = {
    id: ctx.options.getString("category", true),
    name: ctx.options.getString("name", false) ?? undefined,
    namingScheme: ctx.options.getString("naming", false) ?? undefined,
    maxChannels: ctx.options.getInteger("max-channels") ?? undefined,
    maxUsersPerChannel: ctx.options.getInteger("max-members") || undefined,
    parentId: ctx.options.getChannel("parent", false, [
      ChannelType.GuildCategory,
    ])?.id,
  };

  if (options.id === "%none%") {
    await ctx.reply(
      ErrorResponse("You must specify a valid category to edit.")
    );
    return;
  }

  await ctx.deferReply({ flags: EphemeralFlags });

  let category = await TempChannelCategory.findOne({
    guildId: ctx.guildId,
    _id: options.id,
  });

  if (!category) {
    await ctx.editReply(
      ErrorResponse("The specified category does not exist.")
    );
    return;
  }

  /**
   * Parameters object for updating a temporary channel category configuration.
   *
   * Conditionally includes properties from the options object only if they are defined,
   * using spread syntax to avoid setting undefined values.
   */
  const setParams: Partial<ITempChannelCategory> = {
    ...(options.name && { name: options.name }),
    ...(options.namingScheme && { namingScheme: options.namingScheme }),
    ...(options.maxChannels !== undefined && {
      maxChannels: options.maxChannels,
    }),
    ...(options.maxUsersPerChannel !== undefined && {
      maxUsersPerChannel: options.maxUsersPerChannel,
    }),
    ...(options.parentId !== undefined && { parentId: options.parentId }),
  };

  if (Object.keys(setParams).length > 0) {
    // Only update if there are changes
    category = await TempChannelCategory.findByIdAndUpdate(
      category._id,
      { $set: setParams },
      { new: true }
    );
  }

  if (!category) {
    await ctx.editReply(ErrorResponse("Failed to update category."));
    return;
  }

  await deleteTempChannels(ctx.guild, category.id);
  const result = await createAndSaveTempChannel(
    ctx.guild,
    category,
    options.parentId || null,
    false
  );
  if (!result.success) {
    await ctx.editReply(ErrorResponse(result.error));
    return;
  }

  await ctx.editReply({
    flags: EphemeralComponentsV2Flags,
    components: [
      SuccessContainer().addTextDisplayComponents((t) =>
        t.setContent(
          `> Updated category settings:\n\`\`\`${JSON.stringify(
            setParams,
            null,
            1
          )}\`\`\``
        )
      ),
      buildCategoryInfo(category, true, Colors.Green, true),
    ],
  });
}

async function listCategoriesOrChannels(
  ctx: CachedCommandInteraction
): Promise<void> {
  const categoryValue = ctx.options.getString("category", false);
  if (categoryValue) {
    await listCategoryChannels(ctx);
    return;
  }

  await listCategories(ctx);
}

async function listCategories(ctx: CachedCommandInteraction): Promise<void> {
  const categories = await TempChannelCategory.find(
    {
      guildId: ctx.guildId,
    },
    null,
    { sort: { name: 1 }, limit: 100 } // We don't assume that we're hitting the 6000 character limit currently, so we don't have to implement pagination
  );

  if (categories.length === 0) {
    await ctx.reply(ErrorResponse("No temp voice categories found."));
    return;
  }

  const channelCounts: { id: string; count: number }[] =
    await TempChannel.aggregate([
      {
        $match: {
          guildId: ctx.guildId,
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

  const channelCountMap = new Map<string, number>();
  channelCounts.forEach((item) => {
    channelCountMap.set(item.id, item.count);
  });

  const categoryList = categories.map((cat) => {
    const count = channelCountMap.get(cat.id) || 0;
    return {
      id: cat.id,
      name: cat.name,
      value: `- \`${cat.name}\` (${count} channel${count === 1 ? "" : "s"})`,
    };
  });

  await ctx.reply({
    flags: EphemeralComponentsV2Flags,
    components: [
      SuccessContainer()
        .addTextDisplayComponents((t) =>
          t.setContent("### Temporary Voice Categories:")
        )
        .addSectionComponents(
          ...categoryList.map((item) =>
            new SectionBuilder()
              .addTextDisplayComponents((t) => t.setContent(item.value))
              .setButtonAccessory((b) =>
                b
                  .setCustomId(`tempChannelCategory/info?${item.id}`)
                  .setEmoji({ name: "ℹ️" })
                  .setStyle(2)
              )
          )
        ),
    ],
  });
}

async function listCategoryChannels(
  ctx: CachedCommandInteraction
): Promise<void> {
  const categoryValue = ctx.options.getString("category", true);
  const category = await TempChannelCategory.findById(categoryValue);
  if (!category || categoryValue === "%none%") {
    await ctx.reply(
      ErrorResponse("The specified category does not exist or is invalid.")
    );
    return;
  }

  const channels = await TempChannel.find(
    {
      guildId: ctx.guildId,
      category: category._id,
    },
    null,
    { sort: { createdAt: 1 } } // Sort by creation date, oldest first
  );

  if (channels.length === 0) {
    await ctx.reply(
      ErrorResponse(
        `No temporary channels found for category \`${category.name}\`.`
      )
    );
    return;
  }

  const channelList = channels.map((c) => `- <#${c.channelId}>`).join("\n");

  await ctx.reply({
    flags: EphemeralComponentsV2Flags,
    components: [
      SuccessContainer().addTextDisplayComponents(
        (t) => t.setContent(`### \`${category.name}\`:`),
        (t) => t.setContent(channelList)
      ),
    ],
  });
  return;
}

export default {
  data: data,
  run: run,
  autocomplete: autocomplete,
};
