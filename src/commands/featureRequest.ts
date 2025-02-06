import {
    ChannelType,
    ChatInputCommandInteraction,
    Colors,
    PublicThreadChannel,
    SlashCommandBuilder,
    ThreadEditOptions,
} from "discord.js";
import { HydratedDocument } from "mongoose";
import { FeatureRequest, IFeatureRequest } from "../models/featureRequest.js";
import {
    FeatureRequestStatus,
    FeatureRequestStatusEmojis,
} from "../utils/enums.js";
const { devRoleId, threadManagerRole } = (
  await import("../../config.json", {
    with: { type: "json" },
  })
).default;

const STATUS_COLORS = {
  [FeatureRequestStatus.Accepted]: Colors.Aqua,
  [FeatureRequestStatus.Denied]: Colors.Red,
  [FeatureRequestStatus.Duplicate]: Colors.Yellow,
  [FeatureRequestStatus.Implemented]: Colors.Green,
};

export default {
  data: new SlashCommandBuilder()
    .setName("feature-request")
    .setDescription("Edit the status of a feature request")
    .setDefaultMemberPermissions(8)
    .addStringOption((op) =>
      op
        .setName("status")
        .setDescription("The new status of the feature request")
        .setRequired(true)
        .addChoices(
          {
            name: "Accepted",
            value: String(FeatureRequestStatus.Accepted),
          },
          {
            name: "Denied",
            value: String(FeatureRequestStatus.Denied),
          },
          {
            name: "Duplicate",
            value: String(FeatureRequestStatus.Duplicate),
          },
          {
            name: "Implemented",
            value: String(FeatureRequestStatus.Implemented),
          }
        )
    )
    .addStringOption((op) =>
      op
        .setName("reason")
        .setDescription("The reason for the new status")
        .setRequired(false)
        .setMaxLength(1024)
    )
    .addStringOption((op) =>
      op
        .setName("id")
        .setDescription(
          "The ID of the feature request | Only needed if not run in the thread"
        )
        .setRequired(false)
    ),

  async run(ctx: ChatInputCommandInteraction) {
    if (!ctx.inCachedGuild()) return; // Because of TS bs

    const statusInt = Number(
      ctx.options.getString("status")
    ) as FeatureRequestStatus;

    if (
      ctx.channel.type != ChannelType.PublicThread &&
      !ctx.options.getString("id")
    ) {
      await ctx.reply({
        content:
          "### :x: Please run this command in the thread or provide a valid request ID.",
        flags: 64,
      });
      return;
    }

    // Other staff members can mark it as a duplicate

    const newStatusDuplicate = statusInt == FeatureRequestStatus.Duplicate;
    const isDev = ctx.member.roles.cache.has(devRoleId);
    const isThreadManager = ctx.member.roles.cache.has(threadManagerRole);

    if (
      (newStatusDuplicate && !isThreadManager) ||
      (!newStatusDuplicate && !isDev)
    ) {
      return await ctx.reply({
        content: "### :x: You do not have permission to do this.",
        flags: 64,
      });
    }

    const id = ctx.options.getString("id");
    let fr: HydratedDocument<IFeatureRequest>;
    if (id) fr = await FeatureRequest.findById(id);
    else
      fr = await FeatureRequest.findOne({
        threadId: ctx.channel.id,
      });

    if (!fr) {
      return await ctx.reply({
        content: "### :x: Request not found.",
        flags: 64,
      });
    }

    /*
    only allow editing of the status if the request is pending
    or
    if the new status is implemented
    */
    if (
      fr.status != FeatureRequestStatus.Pending &&
      statusInt != FeatureRequestStatus.Implemented
    ) {
      return await ctx.reply({
        content: "### :x: This request has already been resolved.",
        flags: 64,
      });
    } else if (fr.status == statusInt) {
      return await ctx.reply({
        content: `### :x: This request already is marked as \`${FeatureRequestStatus[statusInt]}\`.`,
        flags: 64,
      });
    }

    const reason = ctx.options.getString("reason") || "";
    if (reason.length == 0 && statusInt == FeatureRequestStatus.Denied) {
      return await ctx.reply({
        content: "### :x: You must provide a reason for denying a request.",
        flags: 64,
      });
    }

    const newStatusTitle = FeatureRequestStatus[statusInt];

    await fr.updateOne({
      status: statusInt,
    });

    await ctx.reply({
      content: `<@${fr.userId}>`,
      embeds: [
        {
          author: {
            name: ctx.user.username,
            icon_url: ctx.user.displayAvatarURL(),
          },
          title: "Feature Request Status Updated",
          description: `The status of the feature request has been updated to \`${newStatusTitle}\`.`,
          color: STATUS_COLORS[statusInt],
          fields: reason.length > 0 ? [{ name: "Reason", value: reason }] : [],
        },
      ],
    });

    let thread: PublicThreadChannel;
    if (ctx.channel.isThread()) {
      thread = ctx.channel as PublicThreadChannel;
    } else {
      thread = (await ctx.guild.channels.fetch(
        fr.threadId
      )) as PublicThreadChannel;
    }

    let threadNameSplits = thread.name.split(" | ");
    threadNameSplits[0] = FeatureRequestStatusEmojis[statusInt];

    let threadEditFields = {
      name: threadNameSplits.join(" | "),
      locked: FeatureRequestStatus.Accepted != statusInt,
    } as ThreadEditOptions;
    await thread.edit(threadEditFields);
  },
};
