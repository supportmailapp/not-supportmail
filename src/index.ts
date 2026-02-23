import { readdirSync } from "node:fs";
import { join as pathJoin } from "node:path";

import { Collection, Events, TextDisplayBuilder } from "discord.js";
import * as Sentry from "@sentry/bun";
import mongoose from "mongoose";
import { parseCustomId } from "./utils/main.js";

import { ComponentsV2Flags, EphemeralV2Flags } from "./utils/enums.js";

import { client } from "./client.js";
import { initializeAgenda } from "./scheduler/agenda.js";

let commands = new Collection<string, any>();
let components = new Collection<string, any>();
let eventListeners = new Map<string, string[]>();
const FILE_EXTENSION = ".ts";

async function loadCommands() {
  const newCommands = new Collection<string, () => Promise<any>>();
  const commandsPath = pathJoin(__dirname, "commands");
  const commandFiles = readdirSync(commandsPath, { encoding: "utf-8" })
    .filter((fn) => fn.endsWith(FILE_EXTENSION))
    .map((fn) => pathJoin(commandsPath, fn));

  for (const file of commandFiles) {
    try {
      const fileExports = await import(file);
      if (fileExports && "data" in fileExports && "run" in fileExports) {
        newCommands.set(fileExports.data.name, fileExports);
      } else {
        Sentry.captureMessage(
          `The command at ${file} is missing a required "data" or "run" property.`,
        );
      }
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  // Replace the commands collection
  commands.clear();
  newCommands.forEach((value, key) => {
    commands.set(key, value);
  });
  return commands;
}

// Function to load components
async function loadComponents() {
  const newComponents = new Collection<string, any>();
  const componentsPath = pathJoin(__dirname, "components");
  const componentFiles = readdirSync(componentsPath, { encoding: "utf-8" })
    .filter((file) => file.endsWith(FILE_EXTENSION))
    .map((fn) => pathJoin(componentsPath, fn));

  for (const file of componentFiles) {
    try {
      const fileExports = await import(file);
      if (
        fileExports &&
        ("prefix" in fileExports || "PREFIX" in fileExports) &&
        "run" in fileExports
      ) {
        newComponents.set(
          fileExports.prefix || fileExports.PREFIX,
          fileExports,
        );
      } else {
        Sentry.captureMessage(
          `The component at ${file} is missing a required "prefix" or "run" property.`,
        );
      }
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  // Replace the components collection
  components.clear();
  newComponents.forEach((value, key) => {
    components.set(key, value);
  });
  return components;
}

// Function to load event listeners
async function loadEvents() {
  const eventsPath = pathJoin(__dirname, "events");
  const eventsFolders = readdirSync(eventsPath, { encoding: "utf-8" });
  const clearedEventFolders = eventsFolders.filter((f) =>
    Object.values(Events).includes(f as any),
  );

  for (const event of clearedEventFolders) {
    let eventPath = pathJoin(eventsPath, event);
    let eventFiles = readdirSync(eventPath)
      .filter((file) => file.endsWith(FILE_EXTENSION))
      .map((fn) => pathJoin(eventPath, fn));

    for (let file of eventFiles) {
      try {
        const fileExports = await import(file);
        for (const key in fileExports) {
          const exported = fileExports[key];
          if (typeof exported === "function") {
            client.on(event, (...args) => exported(...args));
            if (!eventListeners.has(event)) eventListeners.set(event, []);
            eventListeners.get(event)!.push(file);
          } else {
            console.warn(
              `The event at ${file} does not export a function or EventHandler class.`,
            );
          }
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    }
  }
}

async function loadAllModules() {
  console.info("Starting module loading...");

  try {
    const startTime = Date.now();

    await loadCommands();
    await loadComponents();
    await loadEvents();

    const loadTime = Date.now() - startTime;
    console.info(
      `All modules loaded successfully - Commands: ${commands.size}, Components: ${components.size}, Events: ${eventListeners.size}, Load time: ${loadTime}ms`,
    );

    return { commands, components, eventListeners };
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

client.on("interactionCreate", async (interaction) => {
  // Command Handling
  if (interaction.isCommand() || interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      return console.error(
        `No command matching '${interaction.commandName}' was found.`,
      );
    }

    try {
      if (interaction.isAutocomplete() && command.autocomplete) {
        await command.autocomplete(interaction);
      } else if (interaction.isAutocomplete() && !command.autocomplete) {
        console.error(
          `No autocomplete function found for command '${interaction.commandName}'`,
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
                "There was an error while executing this command!",
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
                "There was an error while executing this command!",
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
      console.error(
        `No component matching '${interaction.customId}' was found.`,
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
                "There was an error while executing this component!",
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
    }`,
  );

  await client.application.commands.fetch();
  console.info("Commands fetched");
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

await mongoose.connect(Bun.env.MONGO_URI!);
console.info("Connected to DB");
await loadAllModules();
console.info("Modules loaded");

if (mongoose.connection.db) {
  await initializeAgenda(mongoose.connection.db);
} else {
  Sentry.captureMessage(
    "Failed to initialize Agenda: No database connection available.",
  );
}

await client.login(Bun.env.BOT_TOKEN);
console.info("Bot started");
