import { Collection, SlashCommandBuilder } from "discord.js";
import { readdirSync } from "node:fs";
import { join as pathJoin } from "path";
import { deployCommands } from "./utils/commandHelper";

async function main() {
  if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error("BOT_TOKEN or CLIENT_ID environment variables are not set.");
    return;
  }
  const commands = new Collection<string, SlashCommandBuilder>();
  const commandsPath = pathJoin(__dirname, "commands");
  const commandFiles = readdirSync(commandsPath, { encoding: "utf-8" })
    .filter((fn) => fn.endsWith(".ts"))
    .map((fn) => pathJoin(commandsPath, fn));

  for (const file of commandFiles) {
    try {
      const fileExports = await import(file);
      if (fileExports && "data" in fileExports) {
        commands.set(fileExports.data.name, fileExports.data);
      } else {
        throw `The command at ${file} is missing a required "data" or "run" property.`;
      }
    } catch (error) {
      console.error(error);
      return;
    }
  }

  console.log(`Loaded ${commands.size} commands:`);

  const success = await deployCommands(pathJoin(__dirname, "commands"), {
    appId: process.env.CLIENT_ID!,
    appToken: process.env.BOT_TOKEN!,
    fileExtension: ".ts",
  });
  if (success) {
    console.log("Commands deployed successfully");
  } else {
    console.error("Failed to deploy commands");
  }
}

await main();
