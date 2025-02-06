import dayjs from "dayjs";
import {
    ActionRowBuilder,
    EmbedBuilder,
    ModalBuilder,
    ModalMessageModalSubmitInteraction,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    ThreadAutoArchiveDuration,
} from "discord.js";
import NodeCache from "node-cache";
import { FeatureRequest, IFeatureRequest } from "../models/featureRequest.js";
import { DBStickyMessage } from "../models/stickyMessage.js";
import {
    FeatureRequestCategory,
    FeatureRequestColors,
    FeatureRequestStatusEmojis,
    FeatureRequestTitles,
} from "../utils/enums.js";
import { delay } from "../utils/main.js";
import { sendRequestSticky } from "../utils/requestsUtils.js";

const { featureRequestChannel } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

// Only one request per hour
let cache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 60,
  errorOnMissing: false,
});

export default {
  prefix: "featureRequest",

  async run(
    ctx: StringSelectMenuInteraction | ModalMessageModalSubmitInteraction
  ) {
    const waitUntil = cache.get(ctx.user.id);
    if (waitUntil) {
      await ctx.reply({
        content:
          "### ⏳ You can only submit one request per hour.\n" +
          `You can submit a new request <t:${waitUntil}:R>`,
        flags: 64,
      });
    }

    if (ctx.isStringSelectMenu()) {
      const inputs = [
        new TextInputBuilder({
          customId: "shortDescription",
          label: "Your request (in short)",
          minLength: 5,
          maxLength: 512,
          style: 1,
          required: true,
        }),
        new TextInputBuilder({
          customId: "longDescription",
          label: "Your request (in detail)",
          minLength: 10,
          maxLength: 4000,
          style: 2,
          required: true,
        }),
        new TextInputBuilder({
          customId: "whyBenefit",
          label: "Why would this be beneficial?",
          minLength: 10,
          maxLength: 1024,
          style: 2,
          required: true,
        }),
      ];

      if (ctx.values[0] === String(FeatureRequestCategory.Other))
        inputs.unshift(
          new TextInputBuilder({
            customId: "customCategory",
            label: "Category",
            placeholder: "The type of feature the request is for",
            minLength: 3,
            maxLength: 64,
            style: 1,
            required: true,
          })
        );

      await ctx.showModal(
        new ModalBuilder()
          .setTitle("Feature Request")
          .setCustomId(`featureRequest?${ctx.values[0]}`) // the enum value of the FeatureRequestCategory
          .setComponents(
            ...inputs.map((ti) =>
              new ActionRowBuilder<TextInputBuilder>().setComponents(ti)
            )
          )
      );
      return;
    }

    await ctx.update({ components: ctx.message.components });

    let requestData: Partial<IFeatureRequest> = {};
    const fields = ctx.fields;
    const categoryValueStr = ctx.customId.split("?")[1];
    requestData.category = Number(categoryValueStr);
    if (requestData.category === FeatureRequestCategory.Other)
      requestData.customCategory = fields.getTextInputValue("customCategory");

    requestData.shortDescription = fields.getTextInputValue("shortDescription");
    requestData.longDescription = fields.getTextInputValue("longDescription");
    requestData.whyBenefit = fields.getTextInputValue("whyBenefit");
    requestData.userId = ctx.user.id;

    const requestTitle = FeatureRequestTitles[requestData.category];
    const requestColor = FeatureRequestColors[requestData.category];

    const fRequest = await FeatureRequest.create(requestData);

    const channel = (await ctx.guild.channels.fetch(
      featureRequestChannel
    )) as TextChannel;
    const message = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `${ctx.user.username} | ${ctx.user.id}`,
            iconURL: ctx.user.avatarURL(),
            url: `https://discord.com/users/${ctx.user.id}`,
          })
          .setTitle(requestTitle)
          .setDescription(requestData.shortDescription)
          .setFields({
            name: "Why would this be beneficial?",
            value: requestData.whyBenefit,
          })
          .setImage("https://i.ibb.co/sgGD4TC/invBar.png"),
        new EmbedBuilder()
          .setAuthor({ name: "Long Description" })
          .setDescription(`${requestData.longDescription}`)
          .setImage("https://i.ibb.co/sgGD4TC/invBar.png")
          .setTimestamp(dayjs().toDate())
          .setFooter({
            text: "Request ID: " + fRequest._id.toHexString(),
          }),
      ].map((e) => e.setColor(requestColor)), // This is simpler than setting the color for each embed
    });

    requestData.threadId = message.id; // The id of the created thread is the same as the id of the source message

    let sticky = await DBStickyMessage.findOne({ channelId: channel.id });
    if (sticky) {
      await channel.messages.delete(sticky.messageId);
      const newSticky = await sendRequestSticky(channel);
      await sticky.updateOne({ messageId: newSticky.id });
    }

    await delay(1000);

    const thread = await message.startThread({
      name: `${FeatureRequestStatusEmojis[0]} | ${ctx.user.username} | ${requestTitle}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      rateLimitPerUser: 2,
    });

    await fRequest.updateOne({ threadId: thread.id });

    await thread.send(`-# <@${ctx.user.id}>`);
    await thread.members.add("@me");

    try {
      await ctx.user.send({
        embeds: [
          {
            title: "Your feature request has been submitted!",
            description: `View it [here](https://discord.com/channels/${ctx.guild.id}/${thread.id})`,
            color: requestColor,
            footer: {
              text: `Request ID: ${fRequest._id.toHexString()}`,
            },
          },
        ],
      });
    } catch (e) {
      // User has DMs disabled
    }

    cache.set(ctx.user.id, dayjs().add(1, "hour").unix().toString());
  },
};
