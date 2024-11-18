import dayjs from "dayjs";
import {
  APIApplicationCommandOptionChoice,
  APIEmbed,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Colors,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { HydratedDocument } from "mongoose";
import {
  IIncident,
  Incident,
  IStatusUpdate,
  StatusUpdate,
} from "../models/incident.js";
import { IncidentStatus, IncidentStatusColors } from "../utils/enums.js";
const { statusChannelId, statusPing } = (
  await import("../../config.json", { with: { type: "json" } })
).default;

function run(ctx: ChatInputCommandInteraction) {
  const subcommand = ctx.options.getSubcommand(true);

  switch (subcommand) {
    case "create":
      return createIncident(ctx);
    case "update":
      return updateIncident(ctx);
  }
}

const DEFAULT_STATUS_CONTENTS = {
  [IncidentStatus.Investigating]: "We are currently investigating this issue.",
  [IncidentStatus.Identified]:
    "The issue was identified and we are working on a fix.",
  [IncidentStatus.Monitoring]:
    "A fix was deployed and we are monitoring the situation.",
  [IncidentStatus.Resolved]: "The issue has been resolved.",
};

function formatIncident(
  incident: HydratedDocument<IIncident>,
  statusUpdates: HydratedDocument<IStatusUpdate>[]
): APIEmbed {
  const startedAtTs = ~~(incident.createdAt.getTime() / 1000);

  return {
    title: incident.title,
    description:
      statusUpdates.length > 1
        ? `Started: <t:${startedAtTs}> (<t:${startedAtTs}:R>)`
        : "",
    color: IncidentStatusColors[statusUpdates[statusUpdates.length - 1].status],
    timestamp: dayjs(incident.updatedAt).toISOString(),
    fields: statusUpdates.map((update) => ({
      name: `[ <t:${~~(update.updatedAt.getTime() / 1000)}:R> ] ${
        IncidentStatus[update.status]
      }`,
      value: update.content,
      inline: false,
    })),
    footer: {
      text: incident.id,
    },
  };
}

async function createIncident(ctx: ChatInputCommandInteraction) {
  const title = ctx.options.getString("title", true);
  const status =
    parseInt(ctx.options.getString("status", true)) ||
    IncidentStatus.Investigating;
  const content =
    ctx.options.getString("content", false) ||
    DEFAULT_STATUS_CONTENTS[String(status)];
  const ping = ctx.options.getBoolean("ping", false);

  const incident = await Incident.create({
    title: title,
  });

  const statusU = await StatusUpdate.create({
    incidentId: incident.id,
    status: status,
    content: content,
  });

  await ctx.reply({
    embeds: [
      {
        title: "Incident Created",
        description: "_Waiting for sending..._",
        color: Colors.DarkAqua,
      },
    ],
    ephemeral: true,
  });

  const channel = (await ctx.guild.channels.fetch(
    statusChannelId
  )) as TextChannel;

  // Send the incident to the status channel
  const message = await channel.send({
    content: ping ? `<@&${statusPing}>` : "",
    embeds: [formatIncident(incident, [statusU])],
  });

  await new Promise((r) => setTimeout(r, 1000)); // Might fix an issue with status update not existing yet

  await ctx.editReply({
    embeds: [
      {
        title: "Incident Created",
        description: `Incident created with ID \`${incident.id}\``,
        color: Colors.Green,
      },
    ],
  });

  await StatusUpdate.findByIdAndUpdate(statusU._id, { messageId: message.id });
}

async function updateIncident(ctx: ChatInputCommandInteraction) {
  await ctx.deferReply({ ephemeral: true });

  const id = ctx.options.getString("id", true);
  const status = parseInt(ctx.options.getString("status", true));
  const content = ctx.options.getString("content", false);

  if (id === "%") return await ctx.editReply("No incident found.");

  const incident = await Incident.findById(id);
  if (!incident) return await ctx.editReply("Invalid incident ID.");
  else if (incident.resolvedAt)
    return await ctx.editReply("This incident is already resolved.");

  await StatusUpdate.create({
    incidentId: id,
    status: status,
    content: content,
  });

  const allStatuses = await StatusUpdate.find(
    {
      incidentId: id,
    },
    null,
    {
      sort: { updatedAt: 1 },
    }
  );

  await ctx.editReply({
    embeds: [
      {
        title: "Incident Updated",
        description: "_Waiting for sending..._",
        color: Colors.DarkAqua,
      },
    ],
  });

  const incidentMessage = {
    embeds: [formatIncident(incident, allStatuses)],
  };

  await new Promise((r) => setTimeout(r, 1000));

  if (status === IncidentStatus.Resolved)
    await incident.updateOne({ resolvedAt: dayjs().toDate() });

  const channel = (await ctx.guild.channels.fetch(
    statusChannelId
  )) as TextChannel;

  await channel.messages.edit(incident.messageId, incidentMessage);

  await ctx.editReply({
    embeds: [
      {
        title: "Incident Updated",
        description: `Incident updated with ID \`${incident.id}\``,
        color: Colors.Green,
      },
    ],
  });
}

const BASE_STATUS_CHOICES: APIApplicationCommandOptionChoice<string>[] = [
  {
    name: "Investigating",
    value: String(IncidentStatus.Investigating),
  },
  {
    name: "Identified",
    value: String(IncidentStatus.Identified),
  },
  {
    name: "Monitoring",
    value: String(IncidentStatus.Monitoring),
  },
];

export default {
  data: new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Incident management commands")
    .setDefaultMemberPermissions(32)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new incident")
        .addStringOption((op) =>
          op
            .setName("title")
            .setDescription("The title of the incident")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((op) =>
          op
            .setName("status")
            .setDescription("The initial status of the incident")
            .setRequired(true)
            .setChoices(...BASE_STATUS_CHOICES)
        )
        .addStringOption((op) =>
          op
            .setName("content")
            .setDescription(
              "The content of the inital status |Inherited from the status by default"
            )
            .setRequired(false)
            .setMaxLength(1024)
        )
        .addBooleanOption((op) =>
          op
            .setName("ping")
            .setDescription("Whether to ping the role")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("update")
        .setDescription("Update an incident")
        .addStringOption((op) =>
          op
            .setName("id")
            .setDescription("The ID of the incident")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((op) =>
          op
            .setName("status")
            .setDescription("The status of the status update")
            .setRequired(true)
            .setChoices(...BASE_STATUS_CHOICES, {
              name: "Resolved",
              value: String(IncidentStatus.Resolved),
            })
        )
        .addStringOption((op) =>
          op
            .setName("content")
            .setDescription("The content of the status update")
            .setRequired(true)
            .setMaxLength(1024)
        )
    ),

  run,

  async autocomplete(interaction: AutocompleteInteraction) {
    // Send back all active incidents, where the ID partially matches the input (oldest first)
    if (interaction.options.getFocused(true).name !== "id") return;
    const incidents = await Incident.find({ resolvedAt: null }, null, {
      sort: { createdAt: 1 },
    });

    if (incidents.length == 0)
      return await interaction.respond([
        {
          name: "No active incidents found.",
          value: "%",
        },
      ]);

    const idInput = interaction.options.getString("id", false) || "";
    return await interaction.respond(
      incidents
        .filter((i) => i.id.startsWith(idInput))
        .map((i) => ({ name: i.id, value: i.id }))
    );
  },
};
