import { SlashCommandBuilder } from "discord.js";

export default {};

declare global {
  namespace App {
    type CommandFile = {
      /**
       * The data for the slash command
       *
       * @see {@link https://discord.js.org/docs/packages/builders/1.9.0/SlashCommandBuilder:Class}
       */
      data?: SlashCommandBuilder;
      /**
       * The function that should be run when the command is executed
       */
      run?: Function;
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
      prefix?: string;
      /**
       * The function that should be run when the component is triggered
       */
      run?: Function;
      [key: string]: any;
    };

    type EventFile = Function;
  }
}
