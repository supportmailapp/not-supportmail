import { ActionRowBuilder, ButtonBuilder, Message } from "discord.js";

/**
 *
 * @param {Message} message
 */
export default async function funcNameDoesNotMatter(message) {
  if (
    message.content === "hey" &&
    message.author.id !== message.client.user.id
  ) {
    message.reply({
      content: "Hey there pal!\nClick the button to say hello!",
      components: [
        new ActionRowBuilder().setComponents(
          new ButtonBuilder({
            label: "Hello!",
            customId: `hello?${Math.floor(Math.random() * 10)}`,
            style: 1, // Blurple
          })
        ),
      ],
    });
  }
}
