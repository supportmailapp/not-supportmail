import { readdirSync } from "node:fs";
import { dirname as getDirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Options,
  Partials,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
// @ts-ignore | Ignore because if we don't need it TS goes crazy
import * as Sentry from "@sentry/node";
import { deployCommands } from "djs-command-helper";
import mongoose from "mongoose";
import { parseCustomId } from "./utils/main.js";

import { ComponentsV2Flags, EphemeralV2Flags } from "./utils/enums.js";
import "./utils/instrument.js"; // Import the Sentry instrumentation for better error tracking

const _filename = fileURLToPath(import.meta.url);
const _dirname = getDirname(_filename);

var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],

  makeCache: Options.cacheWithLimits({
    MessageManager: 1024,
    GuildMessageManager: 1024,
  }),

  failIfNotExists: false,

  partials: [Partials.Channel],

  allowedMentions: { parse: ["users", "roles"], repliedUser: false },

  presence: {
    activities: [
      {
        type: ActivityType.Listening,
        name: "🎶 All I Want For Christmas Is You 🎶",
      },
    ],
    status: "online",
  },
});

type CommandFile = {
  /**
   * The data for the slash command
   *
   * @see {@link https://discord.js.org/docs/packages/builders/1.9.0/SlashCommandBuilder:Class}
   */
  data: SlashCommandBuilder;
  /**
   * The function that should be run when the command is executed
   */
  run: Function;
  /**
   * The optional function that should be run when the command is autocompleted
   */
  autocomplete?: Function;
  [key: string]: any;
};

type ComponentFile = {
  /**
   * The prefix of this component
   *
   * @see {@link https://github.com/The-LukeZ/discordjs-app-template?tab=readme-ov-file#component-prefix}
   */
  prefix: string;
  /**
   * The function that should be run when the component is triggered
   */
  run: Function;
  [key: string]: any;
};

type EventFile = Function;

let commands = new Collection<string, CommandFile>();
let components = new Collection<string, ComponentFile>();

const commandsPath = pathJoin(_dirname, "commands");
const commandFiles = readdirSync(commandsPath, { encoding: "utf-8" })
  .filter((fn) => fn.endsWith(".js"))
  .map((fn) => pathJoin(commandsPath, fn));

for (const file of commandFiles) {
  const filePath = "file://" + file;
  const command: CommandFile = (await import(filePath)).default;
  if (typeof command == "object" && "data" in command && "run" in command) {
    commands.set(command.data.name, command);
  } else {
    Sentry.logger.warn(
      `A commandFile is missing a required "data" or "run" property.`,
      {
        filePath,
      }
    );
  }
}

const componentsPath = pathJoin(_dirname, "components");
const componentFiles = readdirSync(componentsPath, { encoding: "utf-8" })
  .filter((fn) => fn.endsWith(".js"))
  .map((fn) => pathJoin(componentsPath, fn));

for (const file of componentFiles) {
  const filePath = "file://" + file;
  const comp: ComponentFile = (await import(filePath)).default;
  if (
    typeof comp === "object" &&
    comp.hasOwnProperty("prefix") &&
    comp.hasOwnProperty("run")
  ) {
    components.set(comp.prefix, comp);
  } else {
    Sentry.logger.error(
      `The componentFile is missing a required "prefix" or "run" property.`,
      {
        filePath,
      }
    );
  }
}

// Event files structure: https://github.com/The-LukeZ/discordjs-app-template?tab=readme-ov-file#events

const eventsPath = pathJoin(_dirname, "events");
const eventsFolders = readdirSync(eventsPath, { encoding: "utf-8" });

for (const event of eventsFolders) {
  let eventPath = pathJoin(eventsPath, event);
  let eventFiles = readdirSync(eventPath)
    .filter((file) => file.endsWith(".js"))
    .map((fn) => pathJoin(eventPath, fn));

  for (let file of eventFiles) {
    const filePath = "file://" + file;
    const func: EventFile = (await import(filePath)).default;
    if (typeof func !== "function") continue;

    client.on(event, (...args) => func(...args));
  }
}

client.on("interactionCreate", async (interaction) => {
  // Command Handling
  if (interaction.isCommand() || interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      return Sentry.logger.error(
        `No command matching '${interaction.commandName}' was found.`
      );
    }

    try {
      if (interaction.isAutocomplete() && command.autocomplete) {
        await command.autocomplete(interaction);
      } else if (interaction.isAutocomplete() && !command.autocomplete) {
        Sentry.logger.error(
          `No autocomplete function found for command '${interaction.commandName}'`
        );
      } else {
        await command.run(interaction);
      }
    } catch (error) {
      Sentry.captureException(error);
      if (interaction.isAutocomplete()) return;

      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            flags: ComponentsV2Flags,
            components: [
              new TextDisplayBuilder().setContent(
                "There was an error while executing this command!"
              ),
            ],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            flags: EphemeralV2Flags,
            components: [
              new TextDisplayBuilder().setContent(
                "There was an error while executing this command!"
              ),
            ],
          })
          .catch(() => {});
      }
    }

    // Component Handling
  } else if (
    // Ignore temporary components with the prefix "~/"
    (interaction.isMessageComponent() || interaction.isModalSubmit()) &&
    !interaction.customId.startsWith("~/")
  ) {
    const comp = components.get(parseCustomId(interaction.customId, true));

    if (!comp) {
      Sentry.logger.error(
        `No component matching '${interaction.customId}' was found.`
      );
      return;
    }

    try {
      await comp.run(interaction);
    } catch (error) {
      const errId = Sentry.captureException(error);
      const replyContent = `There was an error while executing this component!\n\n> Error ID:\n\`\`\`${errId}\`\`\``;
      if (
        interaction.replied ||
        (interaction.deferred && interaction.isMessageComponent())
      ) {
        await interaction
          .editReply({
            flags: ComponentsV2Flags,
            components: [new TextDisplayBuilder().setContent(replyContent)],
          })
          .catch(() => {});
      } else if (interaction.isModalSubmit()) {
        await interaction
          .reply({
            flags: EphemeralV2Flags,
            components: [new TextDisplayBuilder().setContent(replyContent)],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            flags: EphemeralV2Flags,
            components: [
              new TextDisplayBuilder().setContent(
                "There was an error while executing this component!"
              ),
            ],
          })
          .catch(() => {});
      }
    }
  }
});

client.once("clientReady", async (client) => {
  console.info(
    `[${new Date().toLocaleString("en")}] Logged in as ${client.user.tag} | ${
      client.user.id
    }`
  );
  Sentry.logger.info("Logged in", {
    username: client.user.tag,
    applicationId: client.application.id,
  });

  await deployCommands(commandsPath, {
    appId: client.application.id,
    appToken: client.token,
  });
  await client.application.commands.fetch();
  Sentry.logger.info("Commands deployed & fetched");
});

process
  .on("unhandledRejection", (error) => {
    Sentry.captureException(error);
  })
  .on("uncaughtException", (error) => {
    Sentry.captureException(error);
  })
  .on("error", (error) => {
    Sentry.captureException(error);
  });

await mongoose.connect(process.env.MONGO_URI!);
Sentry.logger.info("Connected to DB");

await client.login(process.env.BOT_TOKEN);
Sentry.logger.info("Bot started");

export { client };
