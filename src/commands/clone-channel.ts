import {
  ApplicationIntegrationType,
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("deep-clone-channel")
    .setDescription("Deeply clones a channel for you")
    .setContexts(0)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setDefaultMemberPermissions(32)
    .addChannelOption((op) =>
      op
        .setName("channel")
        .setDescription("The channel to clone")
        .setRequired(true)
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildStageVoice,
          ChannelType.GuildCategory
        )
    ),

  async run(ctx: ChatInputCommandInteraction<"cached">) {
    await ctx.deferReply({ flags: 64 });

    const channel = ctx.options.getChannel("channel", true, [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildStageVoice,
      ChannelType.GuildCategory,
    ]);

    const newChannel = await ctx.guild.channels.create({
      name: channel.name,
      type: channel.type,
      topic:
        channel.type !== ChannelType.GuildCategory && !channel.isVoiceBased()
          ? channel.topic ?? undefined
          : undefined,
      nsfw:
        channel.type !== ChannelType.GuildCategory ? channel.nsfw : undefined,
      bitrate: channel.isVoiceBased() ? channel.bitrate : undefined,
      permissionOverwrites: channel.permissionOverwrites.cache,
      availableTags:
        channel.type === ChannelType.GuildForum
          ? channel.availableTags.map((tag) => {
              // @ts-expect-error - id is always given here
              delete tag.id;
              return tag;
            })
          : undefined,
      defaultAutoArchiveDuration:
        channel.type === ChannelType.GuildForum
          ? channel.defaultAutoArchiveDuration ?? undefined
          : undefined,
      defaultForumLayout:
        channel.type === ChannelType.GuildForum
          ? channel.defaultForumLayout ?? undefined
          : undefined,
      defaultReactionEmoji:
        channel.type === ChannelType.GuildForum
          ? channel.defaultReactionEmoji ?? undefined
          : undefined,
      defaultSortOrder:
        channel.type === ChannelType.GuildForum
          ? channel.defaultSortOrder ?? undefined
          : undefined,
      userLimit: channel.isVoiceBased() ? channel.userLimit : undefined,
      rateLimitPerUser:
        channel.type === ChannelType.GuildText
          ? channel.rateLimitPerUser
          : undefined,
      parent: channel.parent,
      position: channel.position,
      defaultThreadRateLimitPerUser:
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum
          ? channel.defaultThreadRateLimitPerUser ?? undefined
          : undefined,
      rtcRegion: channel.isVoiceBased()
        ? channel.rtcRegion ?? undefined
        : undefined,
      videoQualityMode: channel.isVoiceBased()
        ? channel.videoQualityMode ?? undefined
        : undefined,
    });

    await ctx.editReply(
      `### ✅ Deeply cloned channel <#${channel.id}> to <#${newChannel.id}>`
    );
  },
};
