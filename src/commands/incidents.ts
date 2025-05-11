import dayjs from "dayjs";
import {
  ActionRowBuilder,
  APIApplicationCommandOptionChoice,
  AutocompleteInteraction,
  ButtonBuilder,
  ChatInputCommandInteraction,
  Colors,
  ComponentBuilder,
  ContainerBuilder,
  MessageEditOptions,
  MessageFlags,
  ModalSubmitInteraction,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextChannel,
  TextDisplayBuilder,
  TextInputBuilder,
} from "discord.js";
import humanizeDuration from "humanize-duration";
import { HydratedDocument } from "mongoose";
import {
  IIncident,
  Incident,
  IStatusUpdate,
  StatusUpdate,
} from "../models/incident.js";
import type { ResourceStatus } from "../utils/betterstack.js";
import { IncidentStatus, IncidentStatusColors } from "../utils/enums.js";
import {
  betterstackClient,
  incidentURL,
  isBetterStackEnabled,
  statusIsEqual,
} from "../utils/incidents.js";
import { delay } from "../utils/main.js";

/**
 *
 * @param full Whether to include the "Update" status | Default: true
 * @returns
 */
const STATUS_CHOICES: (
  full?: boolean
) => APIApplicationCommandOptionChoice<string>[] = (full = true) => {
  const choices = [
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
  ];
  if (full) {
    choices.push({
      name: "Update",
      value: String(IncidentStatus.Update),
    });
  }
  choices.push({
    name: "Resolved",
    value: String(IncidentStatus.Resolved),
  });
  return choices;
};

const BETTERSTACK_STATUS_CHOICES: APIApplicationCommandOptionChoice<string>[] =
  [
    {
      name: "Resolved",
      value: "resolved",
    },
    {
      name: "Downtime",
      value: "downtime",
    },
    {
      name: "Degraded",
      value: "degraded",
    },
    {
      name: "Maintenance",
      value: "maintenance",
    },
  ];

export default {
  data: new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Incident management commands")
    .setDefaultMemberPermissions(32)
    .addSubcommand((sub) => {
      sub
        .setName("create")
        .setDescription("Create a new incident")
        .addStringOption((op) =>
          op
            .setName("status")
            .setDescription(
              "The status of the update (Use resolved, if retrospectively)"
            )
            .setRequired(true)
            .setChoices(...STATUS_CHOICES(false))
        );

      if (isBetterStackEnabled()) {
        sub
          .addStringOption((op) =>
            op
              .setName("affected")
              .setDescription(
                "The affected resource (Currently, only one - maybe more in the future)"
              )
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((op) =>
            op
              .setName("resource-status")
              .setDescription(
                "The status of the affected resource (BetterStack)"
              )
              .setRequired(true)
              .setChoices(...BETTERSTACK_STATUS_CHOICES)
          );
      }

      sub.addBooleanOption((op) =>
        op
          .setName("ping")
          .setDescription("Whether to ping the role")
          .setRequired(false)
      );
      return sub;
    })
    .addSubcommand((sub) => {
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
            .setChoices(...STATUS_CHOICES())
        );

      if (isBetterStackEnabled()) {
        sub.addStringOption((op) =>
          op
            .setName("resource-status")
            .setDescription("The status of the affected resource (BetterStack)")
            .setRequired(true)
            .setChoices(...BETTERSTACK_STATUS_CHOICES)
        );
      }

      return sub;
    }),

  run,

  async autocomplete(interaction: AutocompleteInteraction) {
    const option = interaction.options.getFocused(true);
    if (option.name === "id") {
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
    } else if (option.name === "affected") {
      // Only try to get resources if BetterStack is enabled
      if (isBetterStackEnabled() && betterstackClient) {
        try {
          const resources = await betterstackClient.getResources();
          const choices = Array.from(resources.entries()).map(([id, name]) => ({
            name: name,
            value: id,
          }));
          return await interaction.respond(choices);
        } catch (error) {
          console.error("Failed to get BetterStack resources:", error);
          return await interaction.respond([
            {
              name: "Error fetching resources",
              value: "error",
            },
          ]);
        }
      }
      return await interaction.respond([
        {
          name: "BetterStack is not enabled",
          value: "%",
        },
      ]);
    } else {
      return;
    }
  },
};

function run(ctx: ChatInputCommandInteraction) {
  const subcommand = ctx.options.getSubcommand(true);

  const parsedStatus = parseInt(ctx.options.getString("status", true));
  const resourceStatus = ctx.options.getString(
    "resource-status",
    false
  ) as ResourceStatus | null;

  switch (subcommand) {
    case "create":
      return createIncident(
        ctx,
        ctx.options.getString("affected", true),
        parsedStatus,
        resourceStatus
      );
    case "update":
      return updateIncident(ctx, parsedStatus, resourceStatus);
  }
}

/**
 * Formats the incident message for Discord.
 * @param incident The incident document
 * @param statusUpdates The status updates for the incident
 * @param affectedService The affected service for the incident | **Only if BetterStack is enabled!**
 * @returns An array of components for the incident message
 */
function formatIncident(
  incident: HydratedDocument<IIncident>,
  statusUpdates: HydratedDocument<IStatusUpdate>[],
  affectedService: string | null
) {
  const components: ComponentBuilder[] = [];
  const lastStatus = statusUpdates[statusUpdates.length - 1].status;

  if (incident.ping) {
    components.push(
      new TextDisplayBuilder().setContent(`<@&${process.env.ROLE_STATUS_PING}>`)
    );
  }

  const container = new ContainerBuilder().setAccentColor(
    IncidentStatusColors[statusUpdates[statusUpdates.length - 1].status]
  );

  let titleText = `__${incident.title}__`;
  const btstackUrl = incidentURL(incident);

  // Add hyperlink to title if it's not a maintenance incident
  // (maintenance incidents are not synched with betterstack as of now)
  if (incident.betterstack.id && btstackUrl) {
    titleText = `[${titleText}](${btstackUrl})`;
  }

  let content = [
    `## ${titleText}`,
    `- **Type:** \`${incident.typ[0].toUpperCase() + incident.typ.slice(1)}\``,
  ].join("\n");

  if (affectedService) {
    content += `\n- **Affected Service:** \`${affectedService}\``;
  }

  if (statusUpdates.length > 1 && lastStatus === IncidentStatus.Resolved) {
    content += `\n-# Lasted: ${humanizeDuration(
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

  container.addTextDisplayComponents((text) => text.setContent(content));
  container.addSeparatorComponents((sep) =>
    sep.setSpacing(SeparatorSpacingSize.Large)
  );

  for (let i = 0; i < statusUpdates.length; i++) {
    const update = statusUpdates[i];
    container.addTextDisplayComponents((text) =>
      text.setContent(
        `### [ <t:${~~(update.updatedAt.getTime() / 1000)}:R> ] ${
          IncidentStatus[update.status]
        }\n` + update.content
      )
    );
    if (i < statusUpdates.length - 1) {
      container.addSeparatorComponents((sep) => sep);
    }
  }

  components.push(container);
  components.push(new TextDisplayBuilder().setContent(`-# ID: ${incident.id}`));
  return components.map((c) => c.toJSON());
}

async function createIncident(
  ctx: ChatInputCommandInteraction,
  affectedResource: string | null,
  parsedStatus: Exclude<IncidentStatus, IncidentStatus.Update>,
  resourceStatus: ResourceStatus | null
) {
  const betterStackEnabled = isBetterStackEnabled();

  if (betterStackEnabled) {
    if (!resourceStatus) {
      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: [
          new TextDisplayBuilder().setContent(
            "Resource status is required when BetterStack is enabled."
          ),
        ],
      });
      return;
    }

    if (!statusIsEqual(parsedStatus, resourceStatus)) {
      await ctx.reply({
        flags: MessageFlags.IsComponentsV2 | 64,
        components: [
          new TextDisplayBuilder().setContent(
            "The status of the incident and the resource do not match."
          ),
        ],
      });
      return;
    }

    if (affectedResource) {
      const resourceId = await betterstackClient?.findResourceId(
        affectedResource,
        true
      );
      if (!resourceId) {
        await ctx.reply({
          flags: MessageFlags.IsComponentsV2 | 64,
          components: [
            new TextDisplayBuilder().setContent("The resource ID is invalid."),
          ],
        });
        return;
      }
      affectedResource = resourceId;
    }
  }

  const ping = ctx.options.getBoolean("ping", false);

  await ctx.showModal(
    {
      title: "Create Incident",
      customId: "~/create",
      components: [
        new ActionRowBuilder<TextInputBuilder>().setComponents(
          new TextInputBuilder()
            .setCustomId("title")
            .setLabel("Title")
            .setStyle(1)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(64)
            .setPlaceholder("The title of the incident")
        ),
        new ActionRowBuilder<TextInputBuilder>().setComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Message")
            .setStyle(2)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(640)
            .setPlaceholder("The initial status message of the incident")
        ),
      ],
    },
    { withResponse: true }
  );

  let modalCtx: ModalSubmitInteraction;
  try {
    modalCtx = await ctx.awaitModalSubmit({
      time: 900_000,
    });
    await modalCtx.reply({
      flags: MessageFlags.IsComponentsV2 | 64,
      components: [new TextDisplayBuilder().setContent("Creating incident...")],
    });
  } catch {
    return;
  }

  const title = modalCtx.fields.getTextInputValue("title");
  const message = modalCtx.fields.getTextInputValue("message");

  // TODO: Add a way to input `ends_at` field for maintenance
  let reportId: string | null = null;
  let statusUpdateId: string | null = null;

  if (
    betterStackEnabled &&
    betterstackClient &&
    affectedResource &&
    resourceStatus
  ) {
    if (parsedStatus !== IncidentStatus.Maintenance) {
      try {
        const report = await betterstackClient.createStatusReport({
          title: title,
          message: formatBetterstackUpdateMessage(
            parsedStatus,
            message,
            parsedStatus === IncidentStatus.Resolved ? dayjs().toDate() : null
          ),
          report_type: "manual",
          affected_resources: [
            {
              status_page_resource_id: affectedResource,
              status: resourceStatus,
            },
          ],
          published_at: dayjs().toISOString(),
        });
        reportId = report.data.id;
        statusUpdateId = report.data.relationships.status_updates.data[0].id;
      } catch (error) {
        console.error("Failed to create BetterStack report:", error);
        // Continue without BetterStack integration
      }
    }
  }

  const incident = await Incident.create({
    title: title,
    ping: !!ping,
    typ:
      parsedStatus === IncidentStatus.Maintenance ? "maintenance" : "incident",
    aggregatedStatus: parsedStatus,
    betterstack: {
      id: reportId,
      affectedServices: affectedResource ? [affectedResource] : [],
    },
  });

  const statusU = await StatusUpdate.create({
    incidentId: incident.id,
    status: parsedStatus,
    content: message,
    betterstack: {
      id: statusUpdateId,
    },
  });

  await modalCtx.editReply({
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.DarkAqua)
        .addTextDisplayComponents((text) =>
          text.setContent("### Incident Created")
        )
        .addTextDisplayComponents((text) =>
          text.setContent("Sending message...")
        ),
    ],
  });

  const channel = (await ctx.guild!.channels.fetch(
    process.env.CHANNEL_STATUS!
  )) as TextChannel;

  let affectedName = null;
  if (isBetterStackEnabled() && affectedResource) {
    affectedName = betterstackClient!.getResourceName(affectedResource);
  }

  // Send the incident to the status channel
  const incidentMsg = await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: formatIncident(incident, [statusU], affectedName),
    allowedMentions: {
      roles: [process.env.ROLE_STATUS_PING!],
    },
  });

  await delay(1000); // Might fix an issue with status update not existing yet

  await Incident.findByIdAndUpdate(incident._id, {
    messageId: incidentMsg.id,
  });

  await modalCtx.editReply({
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Green)
        .addTextDisplayComponents((text) =>
          text.setContent(`### Incident created\n> Incident ID: ${incident.id}`)
        )
        .addActionRowComponents<ButtonBuilder>((row) => {
          row.setComponents(
            new ButtonBuilder()
              .setLabel("View Discord Message")
              .setURL(incidentMsg.url)
              .setStyle(5)
          );
          const url = incidentURL(incident);
          if (url) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel("BetterStack Details")
                .setURL(url)
                .setStyle(5)
            );
          }
          return row;
        }),
    ],
  });
}

async function updateIncident(
  ctx: ChatInputCommandInteraction,
  parsedStatus: IncidentStatus,
  resourceStatus: ResourceStatus | null
) {
  const id = ctx.options.getString("id", true);

  if (id === "%") {
    return await ctx.reply({
      flags: MessageFlags.IsComponentsV2 | 64,
      components: [
        new TextDisplayBuilder().setContent("No active incidents found."),
      ],
    });
  }

  const incident = await Incident.findById(id);
  if (!incident) {
    return await ctx.reply({
      flags: MessageFlags.IsComponentsV2 | 64,
      components: [
        new TextDisplayBuilder().setContent("This incident does not exist."),
      ],
    });
  } else if (incident.resolvedAt) {
    return await ctx.reply({
      flags: MessageFlags.IsComponentsV2 | 64,
      components: [
        new TextDisplayBuilder().setContent(
          "This incident has already been resolved."
        ),
      ],
    });
  }

  await ctx.showModal({
    title: "Update Incident",
    customId: "~/update",
    components: [
      new ActionRowBuilder<TextInputBuilder>().setComponents(
        new TextInputBuilder()
          .setCustomId("message")
          .setLabel("Message")
          .setStyle(2)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(640)
          .setPlaceholder("The status message of the incident")
      ),
    ],
  });

  let modalCtx: ModalSubmitInteraction;
  try {
    modalCtx = await ctx.awaitModalSubmit({
      time: 900_000,
    });
    await modalCtx.reply({
      flags: MessageFlags.IsComponentsV2 | 64,
      components: [new TextDisplayBuilder().setContent("Updating incident...")],
    });
  } catch {
    return;
  }

  const message = modalCtx.fields.getTextInputValue("message");

  let betterstackUpdateId: string | null = null;
  if (
    incident.betterstack.id &&
    isBetterStackEnabled() &&
    resourceStatus !== null
  ) {
    const statusUpdate = await betterstackClient!.createStatusUpdate(
      incident.betterstack.id,
      {
        message: formatBetterstackUpdateMessage(
          parsedStatus,
          message,
          parsedStatus === IncidentStatus.Resolved ? dayjs().toDate() : null
        ),
        affected_resources: [
          {
            status_page_resource_id: incident.betterstack.affectedServices[0],
            status: resourceStatus,
          },
        ],
        published_at: dayjs().toISOString(),
      }
    );
    betterstackUpdateId = statusUpdate.data.id;
  }

  await StatusUpdate.create({
    incidentId: id,
    status: parsedStatus,
    content: message,
    betterstack: {
      id: betterstackUpdateId,
    },
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

  await modalCtx.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.DarkAqua)
        .addTextDisplayComponents((text) =>
          text.setContent("### Incident Updated")
        )
        .addTextDisplayComponents((text) =>
          text.setContent("Updating message...")
        ),
    ],
  });

  let affectedName = null;
  if (isBetterStackEnabled()) {
    affectedName = betterstackClient!.getResourceName(
      incident.betterstack.affectedServices[0]
    );
  }

  const incidentMessage: MessageEditOptions = {
    components: formatIncident(incident, allStatuses, affectedName),
    flags: MessageFlags.IsComponentsV2,
  };

  await delay(1000);

  if (parsedStatus === IncidentStatus.Resolved)
    await incident.updateOne({ resolvedAt: dayjs().toDate() });

  const channel = (await ctx.guild!.channels.fetch(
    process.env.CHANNEL_STATUS!
  )) as TextChannel;

  const incidentMsg = await channel.messages.edit(
    incident.messageId!,
    incidentMessage
  );

  await modalCtx.editReply({
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Green)
        .addTextDisplayComponents((text) =>
          text.setContent(`### Incident updated\n> Incident ID: ${incident.id}`)
        )
        .addActionRowComponents<ButtonBuilder>((row) => {
          row.setComponents(
            new ButtonBuilder()
              .setLabel("View Discord Message")
              .setURL(incidentMsg.url)
              .setStyle(5)
          );
          const url = incidentURL(incident);
          if (url) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel("BetterStack Details")
                .setURL(url)
                .setStyle(5)
            );
          }
          return row;
        }),
    ],
  });
}

/**
 * Use this before sending the message to BetterStack.
 *
 * @param status The status of the current status update
 * @param message The message to send to BetterStack
 * @param createdAt The time when the incident was created
 * (only supply, if status is Resolved, and you want to show the duration)
 */
function formatBetterstackUpdateMessage(
  status: IncidentStatus,
  message: string,
  createdAt: Date | null = null
) {
  let msg = `**Status:** ${IncidentStatus[status]}\n\n${message}`;
  if (status === IncidentStatus.Resolved && createdAt) {
    msg += `\n\n- **Lasted:** ${humanizeDuration(
      dayjs().diff(createdAt, "ms"),
      {
        round: true,
        largest: 3,
        units: ["d", "h", "m"],
        language: "en",
        maxDecimalPoints: 2,
      }
    )}`;
    msg +=
      "As always, if you encounter any issues, please create a post in our [help forum](https://discord.com/channels/1064594649668395128/1303817714615455774)!";
  }
  return msg;
}
