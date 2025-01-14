import {
    ChannelType,
    ChatInputCommandInteraction,
    ContextMenuCommandBuilder,
} from "discord.js";
const { supportForumId } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

export default {
  ignore: true,

  data: new ContextMenuCommandBuilder()
    .setName("Edit Question")
    .setType(3) // Message
    .setContexts(0),

  async run(ctx: ChatInputCommandInteraction) {
    if (
      ctx.channel.type != ChannelType.PublicThread ||
      ctx.channel.parent.type != ChannelType.GuildForum ||
      ctx.channelId !== supportForumId
    ) {
      await ctx.reply({
        content: `This command can only be used in <#${supportForumId}>.`,
        flags: "Ephemeral",
      });
      return;
    }
    return;
  },
};
