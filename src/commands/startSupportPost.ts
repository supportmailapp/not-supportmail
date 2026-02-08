import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ChannelType,
  Colors,
  ComponentType,
  ContainerBuilder,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  type APIMessageTopLevelComponent,
  type JSONEncodable,
} from "discord.js";
import config from "../config";
import {
  buildErrorMessage,
  buildSuccessMessage,
  SimpleText,
} from "../utils/main";
import {
  ComponentsV2Flags,
  EphemeralFlags,
  EphemeralV2Flags,
} from "../utils/enums";

export const data = new ContextMenuCommandBuilder()
  .setType(ApplicationCommandType.Message)
  .setName("Start Support Post")
  .setContexts(0);

export async function run(ctx: ContextMenuCommandInteraction<"cached">) {
  if (!ctx.isMessageContextMenuCommand()) return; // type guard

  if (
    !ctx.member.roles.cache.has(Bun.env.ROLE_THREAD_MANAGER!) &&
    !ctx.member.roles.cache.has(Bun.env.ROLE_DEVELOPER!) &&
    !ctx.member.permissions.has("ManageGuild")
  ) {
    return ctx.reply(
      buildErrorMessage("You don't have permission to use this command."),
    );
  }

  await ctx.deferReply({ flags: EphemeralFlags });

  const forum = await ctx.guild.channels.fetch(config.channels.supportForum);
  if (forum?.type !== ChannelType.GuildForum) return; // type guard

  const reply = await ctx.editReply({
    flags: EphemeralV2Flags,
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(
          SimpleText("Select all tags to apply to this support post"),
        )
        .addActionRowComponents(
          new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
            new StringSelectMenuBuilder()
              .setCustomId("~/selectTags")
              .setMinValues(1)
              .setMaxValues(forum.availableTags.length - 2) // exclude "solved" and "wrong channel" tags
              .setOptions(
                ...forum.availableTags
                  .filter(
                    ({ id }) =>
                      id !== config.supportTags.solved &&
                      id !== config.supportTags.wrongChannel,
                  )
                  .map((t) => ({
                    label: t.name,
                    value: t.id,
                  })),
              ),
          ),
        ),
    ],
  });

  let sCtx: StringSelectMenuInteraction;
  try {
    sCtx = await reply.awaitMessageComponent({
      time: 300_000,
      componentType: ComponentType.StringSelect,
    });
    await sCtx.update({
      flags: EphemeralV2Flags,
      components: [SimpleText("⌛ _Tags selected, creating support post..._")],
    });
  } catch {
    return ctx.deleteReply().catch(() => {}); // ignore if response already deleted
  }

  const message = ctx.targetMessage;
  const author = message.author;

  const comps: JSONEncodable<APIMessageTopLevelComponent>[] = [
    SimpleText(
      `### Support Post for @${author.username}\n**Original Message:** ${message.url}`,
    ),
  ];
  const content =
    message.content.length > 2000
      ? [message.content.slice(0, 2000), message.content.slice(2000, 4000)]
      : [message.content];

  comps.push(
    new ContainerBuilder()
      .setAccentColor(Colors.Yellow)
      .addTextDisplayComponents(...content.map((c) => SimpleText(c))),
  );
  if (message.attachments.size > 0) {
    const imagesNVideos = message.attachments.filter(
      (a) =>
        a.contentType?.startsWith("image/") ||
        a.contentType?.startsWith("video/"),
    );
    if (imagesNVideos.size > 0) {
      comps.push(
        new MediaGalleryBuilder().addItems(
          ...imagesNVideos.map((a) =>
            new MediaGalleryItemBuilder().setURL(a.url).setDescription(a.name!),
          ),
        ),
      );
    }
  }

  const thread = await forum.threads.create({
    name: `Support - @${author.username}`,
    appliedTags: [...sCtx.values],
    message: {
      flags: ComponentsV2Flags,
      components: comps,
      allowedMentions: {
        users: [author.id],
      },
    },
  });

  await sCtx.editReply({
    flags: EphemeralV2Flags,
    components: [SimpleText("⌛ _Support post created, applying tags..._")],
  });

  await message.reply({
    content: `**A Support post has been created for you, please continue [here](${thread.url})!**`,
    allowedMentions: {
      repliedUser: true,
    },
  });

  const response = await sCtx.editReply({
    flags: EphemeralV2Flags,
    components: [
      new SectionBuilder()
        .addTextDisplayComponents(
          SimpleText(`### Support post created successfully!`),
        )
        .setButtonAccessory((b) =>
          b.setLabel("Go to post").setStyle(5).setURL(thread.url),
        ),
      new SeparatorBuilder().setDivider(false).setSpacing(2),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(
            "(Optional) Delete Original Message | Won't affect the support post",
          )
          .setStyle(4)
          .setCustomId("~/deleteOriginal"),
      ),
    ],
  });

  try {
    const bCtx = await response.awaitMessageComponent({
      time: 300_000,
      componentType: ComponentType.Button,
    });

    await message
      .delete()
      .then(() =>
        bCtx.update(
          buildSuccessMessage("Original message deleted successfully!"),
        ),
      )
      .catch(() =>
        bCtx.update(
          buildErrorMessage("**Failed to delete original message.**", false),
        ),
      );
  } catch (e) {
    await sCtx.deleteReply().catch(() => {}); // ignore if message or reply already deleted
  }
}
