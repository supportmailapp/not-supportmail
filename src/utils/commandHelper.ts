import { REST } from "@discordjs/rest";
import { readdirSync } from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/bun";

export interface DeployOptions {
  /**
   * The token of the application that will deploy the commands.
   */
  appToken: string;
  /**
   * The ID of the application that the commands will be deployed to.
   */
  appId: string;
  /**
   * If set to true, the function will log the deployment process.
   *
   * @default true
   */
  logs?: boolean;
  /**
   * The file extension of the command files to be deployed.
   *
   * This can be useful in development environments where you might use `tsx` which allows you to use TypeScript files directly.
   *
   * @default ".js"
   */
  fileExtension?: `.${string}`;
}

export interface DeleteOptions {
  /**
   * The token of the application that will delete the command.
   */
  appToken: string;
  /**
   * The ID of the application that the command will be deleted from.
   */
  appId: string;
  /**
   * The ID of the guild where the command will be deleted. If not set, it is assumed that the command is
   *
   * @default null
   */
  guildId?: string | null;
}

/**
 * A generic command object that can be used to deploy commands to Discord.
 */
export interface GenericCommand {
  /**
   * The command data, as defined by the Discord API or a discord.js-SlashCommandBuilder.
   * For more information, check the [Discord API documentation](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-structure) or the [discord.js documentation](https://discord.js.org/docs/packages/builders/1.9.0/SlashCommandBuilder:Class).
   */
  data: any;
  /**
   * An array of guild IDs where the command should be deployed. If empty, the command will be deployed globally.
   */
  guildIds?: string[];
  /**
   * If set to true, the command will be ignored during deployment.
   *
   * ### This will mean that the command will be removed when it's registered globally.
   */
  ignore?: boolean;
}

const Routes = {
  commands: (appId: string): `/${string}` => {
    return `/applications/${appId}/commands`;
  },
  command: (appId: string, cmdId: string): `/${string}` => {
    return `/applications/${appId}/commands/${cmdId}`;
  },
  guildCommands: (appId: string, guildId: string): `/${string}` => {
    return `/applications/${appId}/guilds/${guildId}/commands`;
  },
  guildCommand: (
    appId: string,
    guildId: string,
    cmdId: string,
  ): `/${string}` => {
    return `/applications/${appId}/guilds/${guildId}/commands/${cmdId}`;
  },
};

/**
 * Create, update and delete global and guild application commands.
 *
 * To update guild-specific commands correctly, make sure the bot is logged in.\
 * Otherwise the check for a guild ID is omitted, and you could make pointless requests which can also result in an error
 */
export async function deployCommands(
  folderPath: string,
  opts: DeployOptions,
): Promise<boolean> {
  opts.logs = opts.logs ?? true;
  const FILE_EXTENSION = opts.fileExtension ?? ".js";
  if (!opts.appToken || !opts.appId) {
    throw new Error("Missing 'appToken' or 'appId' in 'opts'!");
  }

  let commands = [];
  let privateCommands = [];

  const commandFiles = readdirSync(folderPath).filter((file) =>
    file.endsWith(FILE_EXTENSION),
  );

  if (opts.logs)
    console.info(`Started refreshing global and guild commands.`);

  try {
    const rest = new REST().setToken(opts.appToken);

    for (const file of commandFiles) {
      const filePath = path.resolve(folderPath, file);
      const mod = await import(filePath);
      const command = (mod && "default" in mod ? (mod as any).default : mod) as
        | GenericCommand
        | { [key: string]: any };

      // Ensure we have a proper command shape
      if (typeof command !== "object" || !("data" in command)) {
        console.warn(
          `Command at '${file}' is missing the 'data' property!`,
        );
        continue;
      }

      // Respect ignore flag
      if (Boolean(command.ignore ?? false)) {
        if (opts.logs)
          console.info(
            `Command '${command.data?.name ?? file}' is ignored!`,
          );
        continue;
      }

      if ((command.guildIds || []).length > 0) {
        privateCommands.push({
          data: command.data,
          guildIds: command.guildIds,
        });
      } else {
        commands.push(command.data);
      }
    }

    let data: any = await rest.put(Routes.commands(opts.appId), {
      body: commands,
    });
    if (opts.logs)
      console.info(`${data.length} global commands refreshed`);

    for (let cmd of privateCommands) {
      for (let gid of cmd.guildIds) {
        data = null;
        data = await rest.post(Routes.guildCommands(opts.appId, gid), {
          body: cmd.data,
        });
      }
    }
    if (privateCommands.length > 0 && opts.logs) {
      console.info(
        `${privateCommands.length} guild-specific command sets refreshed`,
      );
    }
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * Shortcut method to delete an application command by its ID. **The client needs to be logged in!**
 */
export async function deleteCommand(
  commandId: string,
  opts: DeleteOptions,
): Promise<void> {
  const guildId = opts.guildId ?? null;

  const commandPath = guildId
    ? Routes.guildCommand(opts.appId, guildId, commandId)
    : Routes.command(opts.appId, commandId);

  if (commandId.match(/^\d+$/i)) {
    await new REST({ version: "10" })
      .setToken(opts.appToken)
      .delete(commandPath);
  } else {
    throw new Error("'commandId' is not a only-number-string!");
  }
  return;
}
