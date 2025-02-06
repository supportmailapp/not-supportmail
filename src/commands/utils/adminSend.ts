import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { DBStickyMessage } from "../../models/stickyMessage.js";
import { sendRequestSticky } from "../../utils/requestsUtils.js";
const { featureRequestChannel, supportPanelChannel } = (
  await import("../../../config.json", {
    with: { type: "json" },
  })
).default;

export default async function (ctx: ChatInputCommandInteraction) {
  const option = ctx.options.getString("option");
  await ctx.deferReply({ flags: 64 });

  switch (option) {
    case "featureRequestSticky": {
      const channel = (await ctx.guild.channels.fetch(
        featureRequestChannel
      )) as TextChannel;
      const currentMessage = await DBStickyMessage.findOneAndDelete({
        channelId: channel.id,
      });

      if (currentMessage) {
        await channel.messages
          .delete(currentMessage.messageId)
          .catch(() => null);
      }

      const sticky = await sendRequestSticky(channel);

      await DBStickyMessage.create({
        channelId: channel.id,
        messageId: sticky.id,
      });
      break;
    }
    case "supportPanel": {
      const channel = (await ctx.guild.channels.fetch(
        supportPanelChannel
      )) as TextChannel;

      await channel.send({
        content: [
          "# :wave: Welcome to the support of <@1082707872565182614> !",
          "- :white_check_mark: **Here you can ask for help**, if you have any questions or need help with something.",
          "",
          "- :no_entry_sign: **Don't ask for help in DMs.** We don't provide help that way.",
          "",
          "- :bulb: If you have a **feature request**, please take a look at <#1116023324271726753>.",
          "",
          "- :flag_us: **English only** please.",
          "",
          "- :warning: If you want to report a user or a message, " +
            "**please use the [report command](<https://docs.supportmail.dev/#reports>)**.",
          "",
          "- :timer: **Inactive threads** will be closed **after 3 days** of no communication. So make sure to keep the conversation going if your issue is not solved.",
          "",
          "- :alarm_clock: **Note:**",
          "  Due to the geographic location of the supporters and the developer, they are more likely to respond between <t:1697601600:t> and <t:1697659200:t> than at other times.",
          "",
          "- :rotating_light: **Please be patient** and **don't ping anyone for attention**. Someone will assist you as soon as they can.",
          "",
          "- :star: Please read the [Documentation](<https://docs.supportmail.dev/>) before asking!",
          "  You can also use the AI search function there to find the information you need. If that doesn't help, feel free to ask here.",
          "_ _",
          "_ _",
        ].join("\n"),
        components: [
          // [ General Question, Technical Question, An Error occured, Report a Bug ]
          new ActionRowBuilder<ButtonBuilder>().setComponents(
            new ButtonBuilder({
              label: "General Question",
              customId: "supportPanel?generalQuestion",
              style: 1,
              emoji: { name: "❓" },
            }),
            new ButtonBuilder({
              label: "Technical Question",
              customId: "supportPanel?technicalQuestion",
              style: 1,
              emoji: { name: "🔧" },
            }),
            new ButtonBuilder({
              label: "What does this Error mean?",
              customId: "supportPanel?error",
              style: 1,
              emoji: { name: "❌" },
            }),
            new ButtonBuilder({
              label: "Report a Bug",
              customId: "supportPanel?reportBug", // Check DM permissions beforehand
              style: 1,
              emoji: { name: "🐞" },
            })
          ),
          // [ Billing, Feature Request, Report ]
          new ActionRowBuilder<ButtonBuilder>().setComponents(
            new ButtonBuilder({
              label: "Billing",
              customId: "supportPanel?billing", // This will just be a response to do this in tickets or by email
              style: 1,
              emoji: { name: "💳" },
            }),
            new ButtonBuilder({
              label: "Feature Request",
              customId: "supportPanel?featureRequest", // This will just be a response to do this in the feature request channel
              style: 1,
              emoji: { name: "🌟" },
            }),
            new ButtonBuilder({
              label: "Report",
              customId: "supportPanel?report", // This will just be a response to do this with the commands
              style: 1,
              emoji: { name: "🚨" },
            })
          ),
        ],
      });
      break;
    }
    default:
      await ctx.editReply("## ❌ Invalid option provided.");
      return;
  }

  await ctx.editReply("## ✅ Done!");
}
