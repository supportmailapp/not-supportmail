import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

export function sendRequestSticky(channel: TextChannel) {
  return channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("Feature Requests")
        .setDescription(
          "Click the button below and fill out the form to submit a feature request."
        )
        .setColor("Random"),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().setComponents(
        new ButtonBuilder({
          label: "Create Request",
          style: 1,
          customId: "featureRequest",
          emoji: { name: "📝" },
        })
      ),
    ],
  });
}
