import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ChannelType,
  Colors,
  ComponentType,
  ContainerBuilder,
  ModalBuilder,
  ModalMessageModalSubmitInteraction,
  TextDisplayBuilder,
  TextInputBuilder,
} from "discord.js";
import { parseCustomId, safeParseInt } from "../utils/main.js";
import { EphemeralComponentsV2Flags } from "../utils/enums.js";
import {
  buildCategoryInfo,
  buildCustomId,
  ErrorResponse,
  SuccessContainer,
  type EditAction,
} from "../utils/tempChannels.js";
import {
  TempChannelCategory,
  type ITempChannelCategory,
} from "../models/tempChannel.js";
import { HydratedDocument, UpdateQuery } from "mongoose";

async function run(
  ctx:
    | ButtonInteraction
    | ChannelSelectMenuInteraction
    | ModalMessageModalSubmitInteraction
) {
  const { compPath, component, params } = parseCustomId(ctx.customId);
  const categoryId = params![0];

  if (component === "info") {
    await showInfo(ctx as ButtonInteraction, categoryId);
  } else if (component === "edit") {
    const action = compPath[2] as EditAction;
    const category = await TempChannelCategory.findById(categoryId);
    if (!category) {
      await ctx.reply(ErrorResponse("Category not found."));
      return;
    }
    if (action === "parent") {
      await changeCategory(
        ctx as ButtonInteraction | ChannelSelectMenuInteraction,
        category
      );
    } else {
      if (ctx.isButton()) {
        await showEditModal(ctx, category, action);
      } else {
        await handleEditModalSubmit(
          ctx as ModalMessageModalSubmitInteraction,
          category,
          action
        );
      }
    }
  }
}

const modalInput = (
  callback: (builder: TextInputBuilder) => TextInputBuilder
) => {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    callback(new TextInputBuilder())
  );
};

async function showEditModal(
  ctx: ButtonInteraction,
  category: HydratedDocument<ITempChannelCategory>,
  action: Exclude<EditAction, "parent">
) {
  const customId = buildCustomId("edit", category.id, action);
  const modal = new ModalBuilder().setCustomId(customId);
  switch (action) {
    case "name":
      modal
        .setTitle("Edit Category Name")
        .addComponents(
          modalInput((t) =>
            t
              .setLabel("Category Name")
              .setPlaceholder("Name of the category")
              .setCustomId("0")
              .setMinLength(3)
              .setMaxLength(100)
              .setRequired(true)
              .setValue(category.name)
          )
        );
      break;
    case "namingScheme":
      modal
        .setTitle("Edit Naming Scheme")
        .addComponents(
          modalInput((t) =>
            t
              .setLabel("Naming Scheme")
              .setPlaceholder("Available vars: {number}")
              .setCustomId("0")
              .setMinLength(3)
              .setMaxLength(100)
              .setRequired(true)
              .setValue(category.namingScheme)
          )
        );
      break;
    case "maxUsersPerChannel":
      modal.setTitle("Edit Max Users Per Channel").addComponents(
        modalInput((t) =>
          t
            .setLabel("Max Users Per Channel | 1 - 99")
            .setCustomId("0")
            .setMinLength(1)
            .setMaxLength(2)
            .setRequired(true)
            .setPlaceholder("0 = Unlimited")
            .setValue((category.maxUsersPerChannel || 0).toString())
        )
      );
      break;
    case "maxTempChannels":
      modal
        .setTitle("Edit Max Temp Channels")
        .addComponents(
          modalInput((t) =>
            t
              .setLabel("Max Temp Channels | 1 - 100")
              .setCustomId("0")
              .setMinLength(1)
              .setMaxLength(3)
              .setRequired(true)
              .setValue(category.maxChannels.toString())
          )
        );
      break;
    default:
      await ctx.reply(ErrorResponse("Invalid action."));
      return;
  }

  await ctx.showModal(modal);
}

async function handleEditModalSubmit(
  ctx: ModalMessageModalSubmitInteraction,
  category: HydratedDocument<ITempChannelCategory>,
  action: Exclude<EditAction, "parent">
) {
  await ctx.update({
    flags: EphemeralComponentsV2Flags,
    components: [new TextDisplayBuilder().setContent("Updating category...")],
  });

  const value = ctx.fields.getTextInputValue("0");
  let updateQuery: UpdateQuery<ITempChannelCategory> = {};
  switch (action) {
    case "name":
      updateQuery["name"] = value;
      break;
    case "namingScheme":
      updateQuery["namingScheme"] = value;
      break;
    case "maxUsersPerChannel":
      const maxUsers = safeParseInt(value, 0, 0, 99);
      if (maxUsers === 0) {
        updateQuery["$unset"] = { maxUsersPerChannel: "" };
      } else {
        updateQuery["maxUsersPerChannel"] = maxUsers;
      }
      break;
    case "maxTempChannels":
      updateQuery["maxTempChannels"] = safeParseInt(value, 100, 1, 100);
      break;
    default:
      await ctx.editReply(ErrorResponse("Invalid action."));
      return;
  }

  await category.updateOne(updateQuery);

  await ctx.editReply({
    flags: EphemeralComponentsV2Flags,
    components: [buildCategoryInfo(category, true, Colors.Blue, true)],
  });
}

async function changeCategory(
  btnCtx: ButtonInteraction | ChannelSelectMenuInteraction,
  category: HydratedDocument<ITempChannelCategory>
) {
  const customId = buildCustomId("edit", category.id, "parent", true);
  const reply = await btnCtx.reply({
    flags: EphemeralComponentsV2Flags,
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents((t) =>
          t.setContent("Select a new parent category")
        )
        .addActionRowComponents((a) =>
          a.addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(customId)
              .addChannelTypes(ChannelType.GuildCategory)
              .addDefaultChannels(category?.parentId ? [category.parentId] : [])
              .setMinValues(0)
              .setMaxValues(1)
          )
        ),
    ],
  });

  let newCatId: string | null = null;
  let channelCtx: ChannelSelectMenuInteraction;
  try {
    channelCtx = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === btnCtx.user.id && i.customId === customId,
      time: 600_000, // 10 minutes
      componentType: ComponentType.ChannelSelect,
    });
    newCatId = channelCtx.values.length > 0 ? channelCtx.values[0] : null;
  } catch {
    return;
  }

  let updateQuery: any = {};
  if (!newCatId) {
    updateQuery["$unset"] = { parentId: "" };
  } else {
    updateQuery["$set"] = { parentId: newCatId };
  }

  category = await category.updateOne(updateQuery);
  if (!category) {
    await channelCtx.update(ErrorResponse("Failed to update category parent."));
    return;
  }

  await channelCtx.update({
    flags: EphemeralComponentsV2Flags,
    components: [
      SuccessContainer().addTextDisplayComponents((t) =>
        t.setContent("### ✅ Category parent updated successfully.")
      ),
    ],
  });
  await btnCtx.webhook.editMessage("@original", {
    flags: EphemeralComponentsV2Flags,
    components: [buildCategoryInfo(category, true, Colors.Blue, true)],
  });
}

async function showInfo(ctx: ButtonInteraction, categoryId: string) {
  const category = await TempChannelCategory.findById(categoryId);
  if (!category) {
    await ctx.reply(ErrorResponse("Category invalid or not found."));
    return;
  }

  await ctx.reply({
    flags: EphemeralComponentsV2Flags,
    components: [buildCategoryInfo(category, true, Colors.Blue, true)],
  });
}

export default {
  prefix: "tempChannelCategory",
  run,
};
