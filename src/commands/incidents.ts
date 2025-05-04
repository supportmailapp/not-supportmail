import dayjs from "dayjs";
import {
  APIApplicationCommandOptionChoice,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Colors,
  ComponentBuilder,
  ContainerBuilder,
  type MessageEditOptions,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";
import { HydratedDocument } from "mongoose";
import {
  type IIncident,
  type IStatusUpdate,
  Incident,
  StatusUpdate,
} from "../models/incident.js";
import humanizeDuration from "humanize-duration";
import { IncidentStatus, IncidentStatusColors } from "../utils/enums.js";
import { delay } from "../utils/main.js";

function run(ctx: ChatInputCommandInteraction) {
  const subcommand = ctx.options.getSubcommand(true);

  const parsedStatus = parseInt(ctx.options.getString("status", true));
  const content = ctx.options.getString("content", true);

  switch (subcommand) {
    case "create":
      return createIncident(ctx, parsedStatus, content);
    case "update":
      return updateIncident(ctx, parsedStatus, content);
  }
}

function formatIncident(
  incident: HydratedDocument<IIncident>,
  statusUpdates: HydratedDocument<IStatusUpdate>[],
  ping: boolean = false
) {
  const components: ComponentBuilder[] = [];

  if (ping) {
    components.push(
      new TextDisplayBuilder().setContent(`<@&${process.env.ROLE_STATUS_PING}>`)
    );
  }

  const container = new ContainerBuilder().setAccentColor(
    IncidentStatusColors[statusUpdates[statusUpdates.length - 1].status]
  );
  let content = `### ${incident.title}`;

  if (statusUpdates.length > 1) {
    if (
      statusUpdates[statusUpdates.length - 1].status === IncidentStatus.Resolved
    ) {
      content += `Lasted: ${humanizeDuration(
        dayjs().diff(incident.createdAt, "ms"),
        {
          round: true,
          largest: 3,
          units: ["d", "h", "m"],
          language: "en",
          maxDecimalPoints: 2,
        }
      )}`;
    }
  }

  container.addTextDisplayComponents((text) => text.setContent(content));
  container.addSeparatorComponents((sep) => sep);

  for (let i = 0; i < statusUpdates.length; i++) {
    const update = statusUpdates[i];
    container
      .addTextDisplayComponents((text) =>
        text.setContent(
          `### [ <t:${~~(update.updatedAt.getTime() / 1000)}:R> ] ${
            IncidentStatus[update.status]
          }\n` + update.content
        )
      )
      .addSeparatorComponents((sep) => sep);
  }

  components.push(container);
  components.push(new TextDisplayBuilder().setContent(`-# ID: ${incident.id}`));
  return components.map((c) => c.toJSON());
}

async function createIncident(
  ctx: ChatInputCommandInteraction,
  status: number,
  content: string
) {
  const title = ctx.options.getString("title", true);
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
    flags: MessageFlags.IsComponentsV2 | 64,
    components: [new TextDisplayBuilder().setContent("Creating incident...")],
  });

  const channel = (await ctx.guild!.channels.fetch(
    process.env.CHANNEL_STATUS!
  )) as TextChannel;

  // Send the incident to the status channel
  const message = await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: formatIncident(incident, [statusU], !!ping),
    allowedMentions: {
      roles: [process.env.ROLE_STATUS_PING!],
    },
  });

  await delay(1000); // Might fix an issue with status update not existing yet

  await ctx.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Green)
        .addTextDisplayComponents((text) => text.setContent("Incident created"))
        .addSectionComponents((sec) =>
          sec
            .addTextDisplayComponents((text) =>
              text.setContent(`Incident ID: ${incident.id}`)
            )
            .setButtonAccessory((btn) =>
              btn.setLabel("View").setURL(message.url)
            )
        ),
    ],
  });

  await Incident.findByIdAndUpdate(statusU.incidentId, {
    messageId: message.id,
  });
}

async function updateIncident(
  ctx: ChatInputCommandInteraction,
  status: number,
  content: string
) {
  await ctx.deferReply({ flags: 64 });

  const id = ctx.options.getString("id", true);

  if (id === "%") {
    return await ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new TextDisplayBuilder().setContent("No active incidents found."),
      ],
    });
  }

  const incident = await Incident.findById(id);
  if (!incident) {
    return await ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new TextDisplayBuilder().setContent("This incident does not exist."),
      ],
    });
  } else if (incident.resolvedAt) {
    return await ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new TextDisplayBuilder().setContent(
          "This incident has already been resolved."
        ),
      ],
    });
  }

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
    flags: MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.DarkAqua)
        .addTextDisplayComponents((text) =>
          text.setContent("### Incident Updated")
        )
        .addTextDisplayComponents((text) =>
          text.setContent("Updating incident...")
        ),
    ],
  });

  const incidentMessage: MessageEditOptions = {
    components: formatIncident(incident, allStatuses),
    flags: MessageFlags.IsComponentsV2,
  };

  await delay(1000);

  if (status === IncidentStatus.Resolved)
    await incident.updateOne({ resolvedAt: dayjs().toDate() });

  const channel = (await ctx.guild!.channels.fetch(
    process.env.CHANNEL_STATUS!
  )) as TextChannel;

  await channel.messages.edit(incident.messageId!, incidentMessage);

  await ctx.editReply({
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Green)
        .addTextDisplayComponents((text) =>
          text.setContent("### Incident Updated")
        )
        .addSectionComponents((sec) =>
          sec
            .addTextDisplayComponents((text) =>
              text.setContent(`Incident ID: ${incident.id}`)
            )
            .setButtonAccessory((btn) =>
              btn.setLabel("View").setURL(incident.messageId!).setStyle(5)
            )
        ),
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
  {
    name: "Maintenance",
    value: String(IncidentStatus.Maintenance),
  },
  {
    name: "Update",
    value: String(IncidentStatus.Update),
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
            .setDescription("The content of the initial status")
            .setRequired(true)
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
        .filter((i) => (i.id as string).includes(idInput))
        .map((i) => ({ name: i.id, value: i.id }))
    );
  },
};
