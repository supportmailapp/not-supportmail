import {
  AutoModerationActionExecution,
  Colors,
  ContainerBuilder,
  SeparatorBuilder,
} from "discord.js";
import config from "../../config.js";
import { ComponentsV2Flags } from "../../utils/enums.js";

// We assume the role

export default async function noPingsAutoModerationActionExecution(
  event: AutoModerationActionExecution,
) {
  if (
    !process.env.NO_PINGS_AUTOMOD_RULE_ID ||
    event.ruleId !== process.env.NO_PINGS_AUTOMOD_RULE_ID ||
    !event.channel ||
    !event.channel.isSendable()
  ) {
    return; // This also handles the case of it being undefined
  }

  const { content: msgContent, userId: authorId } = event;
  const devsPinged = determineIsDev(msgContent);

  // split msg content every 2000 characters
  const authorText = `-# <@${authorId}> wrote:`;
  const footerText = "-# " + buildFooterText(devsPinged);
  const textSplits =
    msgContent
      .slice(0, 4000 - authorText.length - footerText.length)
      .match(/[\s\S]{1,2000}/g) || []; // This is 2 at max unless Discord drinks a lil too much
  const container = new ContainerBuilder()
    .setAccentColor(Colors.Orange)
    .addTextDisplayComponents((t) => t.setContent(authorText))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(
      textSplits.map((part) => (t) => t.setContent(part)),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(2))
    .addTextDisplayComponents((t) => t.setContent(footerText));

  await event.channel
    .send({
      flags: ComponentsV2Flags,
      components: [container],
      allowedMentions: { users: [authorId] },
    })
    .catch(() => {});
}

/**
 * Returns the developer objects of the developers mentioned in the content.
 * If no developers are mentioned, returns null.
 */
function determineIsDev(
  content: string | null,
): (typeof config.developers)[number][] | null {
  if (!content) return null;
  const regex = new RegExp(
    "<@(" + config.developers.map((dev) => dev.id).join("|") + ")>",
    "gi",
  );
  const matches = content.match(regex);
  if (!matches) return null;
  const devs = matches
    .map((mention) => {
      const id = mention.replace(/[<@!>]/g, "");
      return config.developers.find((dev) => dev.id === id);
    })
    .filter((dev): dev is (typeof config.developers)[number] => !!dev);
  return devs.length > 0 ? devs : null;
}

const buildFooterText = (
  devs: (typeof config.developers)[number][] | null = null,
) => {
  if (!devs || !devs.length) {
    return "Please don't ping users. They'll reply when they can.";
  } else if (devs.length === 1) {
    switch (devs[0]?.gender || "d") {
      case "m":
        return "Please don't ping the developer. He will answer as soon as possible.";
      case "f":
        return "Please don't ping the developer. She will answer as soon as possible.";
      case "d":
        return "Please don't ping the developer. They will answer as soon as possible.";
    }
  } else {
    return "Please don't ping the developers. They will answer as soon as possible.";
  }
};
