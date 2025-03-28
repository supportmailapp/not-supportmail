import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  TextChannel,
} from "discord.js";
import { FeatureRequestCategory } from "./enums.js";

export function sendRequestSticky(channel: TextChannel) {
  // Label, value, emoji
  const requestCategoriesData: [string, number, string][] = [
    ["Subscriptions", FeatureRequestCategory.Subscriptions, "💳"],
    ["Settings", FeatureRequestCategory.Settings, "⚙️"],
    ["Translations", FeatureRequestCategory.Translations, "🌐"],
    ["Security", FeatureRequestCategory.Security, "🔒"],
    ["Customizability", FeatureRequestCategory.Customizability, "🎨"],
    ["Accessibility", FeatureRequestCategory.Accessibility, "♿"],
    ["Support Server", FeatureRequestCategory.SupportServer, "🧭"],
    ["Other", FeatureRequestCategory.Other, "❔"],
  ];

  return channel.send({
    embeds: [
      new EmbedBuilder()
        .setDescription(
          [
            "# :bulb: Feature Requests",
            "**Select a category below and fill out the form to submit a feature request.**",
            "Due to Discords limitations, you can only send attachments in the thread afterwards.",
          ].join("\n")
        )
        .setFooter({
          text: "Please keep in mind that feature requests are not guaranteed to be implemented.",
        })
        .setColor("Random"),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
        new StringSelectMenuBuilder({
          placeholder: "Select a category",
          customId: "featureRequest",
          options: requestCategoriesData.map(([label, value, emoji]) => ({
            label,
            value: String(value),
            emoji: {
              name: emoji,
            },
          })),
        })
      ),
    ],
  });
}

// builds the page with 10 feature requests
export async function buildSelectorPage(page: number, status: FeatureRequestStatus) {
  const requests = await FeatureRequest.find(
    { status: status },
    null,
    {
      sort: { createdAt: -1 },
      limit: 20,
      skip: (page - 1) * 20
    }
  );
}
