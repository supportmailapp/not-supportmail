import { readdirSync } from "node:fs";
import { dirname as getDirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Client,
  Collection,
  IntentsBitField,
  Options,
  Partials,
} from "discord.js";
import { deployCommands } from "djs-command-helper";

import { parseCustomId } from "./utils/main.js";
import mongoose from "mongoose";

const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

const _filename = fileURLToPath(import.meta.url);
const _dirname = getDirname(_filename);

var client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildWebhooks,
    IntentsBitField.Flags.AutoModerationConfiguration,
    IntentsBitField.Flags.AutoModerationExecution,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildModeration,
  ],

  makeCache: Options.cacheWithLimits({
    MessageManager: 1024,
    GuildMessageManager: 1024,
  }),

  failIfNotExists: false,

  partials: [Partials.Channel],

  allowedMentions: { parse: ["users", "roles"], repliedUser: false },
});

let commands = new Collection<string, App.CommandFile>();
let components = new Collection<string, App.ComponentFile>();

const commandsPath = pathJoin(_dirname, "commands");
const commandFiles = readdirSync(commandsPath, { encoding: "utf-8" })
  .filter((fn) => fn.endsWith(".js"))
  .map((fn) => pathJoin(commandsPath, fn));

for (const file of commandFiles) {
  const filePath = "file://" + file;
  const command: App.CommandFile = (await import(filePath)).default;
  if (typeof command == "object" && "data" in command && "run" in command) {
    commands.set(command.data.name, command);
  } else {
    console.error(
      `[WARNING] The commandFile at ${filePath} is missing a required "data" or "run" property.`
    );
  }
}

const componentsPath = pathJoin(_dirname, "components");
const componentFiles = readdirSync(componentsPath, { encoding: "utf-8" })
  .filter((fn) => fn.endsWith(".js"))
  .map((fn) => pathJoin(componentsPath, fn));

for (const file of componentFiles) {
  const filePath = "file://" + file;
  const comp: App.ComponentFile = (await import(filePath)).default;
  if (
    typeof comp === "object" &&
    comp.hasOwnProperty("prefix") &&
    comp.hasOwnProperty("run")
  ) {
    components.set(comp.prefix, comp);
  } else {
    console.error(
      `[WARNING] The componentFile at ${filePath} is missing a required "prefix" or "run" property.`
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
    const func = (await import(filePath)).default;
    if (typeof func !== "function") continue;

    client.on(event, (...args) => func(...args));
  }
}

client.on("interactionCreate", async (interaction) => {
  // Command Handling
  if (interaction.isCommand() || interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      return console.error(
        `No command matching '${interaction.commandName}' was found.`
      );
    }

    try {
      if (interaction.isAutocomplete()) {
        await command.autocomplete(interaction);
      } else {
        await command.run(interaction);
      }
    } catch (error) {
      console.error(
        `Error while executing command (${interaction.commandName})`,
        error
      );
      if (interaction.isAutocomplete()) return;

      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            content: "There was an error while executing this command!",
          })
          .catch((e) => console.error(e));
      } else {
        await interaction
          .reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          })
          .catch((e) => console.error(e));
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
        `No component matching '${interaction.customId}' was found.`
      );
      return;
    }

    try {
      await comp.run(interaction);
    } catch (error) {
      console.error(
        `Error while executing component (${interaction.customId})`,
        error
      );
      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            content: "There was an error while executing this component!",
          })
          .catch((e) => console.error(e));
      } else {
        await interaction
          .reply({
            content: "There was an error while executing this component!",
            ephemeral: true,
          })
          .catch((e) => console.error(e));
      }
    }
  }
});

client.on("ready", async (client) => {
  console.info(
    `[${new Date().toLocaleString("en")}] Logged in as ${client.user.tag} | ${
      client.user.id
    }`
  );

  // ! Note: You only need to deploy commands when you've made changes to them. So comment this out when you are not working on commands.
  await deployCommands(commandsPath, {
    appId: client.application.id,
    appToken: client.token,
  });
});

(async function start() {
  mongoose.connect(config.MongoDBUrl).then(async () => {
    console.info("Connected to DB");

    client.login(config.botToken);
    console.info("Bot started");
  });
})();
