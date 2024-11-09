import { Colors } from "discord.js";

export enum IncidentStatus {
  Resolved = 0,
  Investigating = 1,
  Identified = 2,
  Monitoring = 3,
}

export const IncidentStatusColors = {
  [IncidentStatus.Resolved]: Colors.Green,
  [IncidentStatus.Investigating]: Colors.Yellow,
  [IncidentStatus.Identified]: Colors.Aqua,
  [IncidentStatus.Monitoring]: Colors.Blurple,
};

export enum FeatureRequestCategory {
  Other = 0,
  Subscriptions = 1,
  Settings = 2,
  Translations = 3,
  Security = 4,
  Customizability = 5,
  Accessibility = 6,
  SupportServer = 7,
}

export const FeatureRequestTitles = {
  0: "Other",
  1: "Subscriptions",
  2: "Settings",
  3: "Translations",
  4: "Security",
  5: "Customizability",
  6: "Accessibility",
  7: "Support Server",
};

export const FeatureRequestColors = {
  0: Colors.Aqua,
  1: Colors.Gold,
  2: Colors.Green,
  3: Colors.Orange,
  4: Colors.Red,
  5: Colors.DarkAqua,
  6: Colors.Blue,
  7: Colors.Navy,
};

export enum FeatureRequestStatus {
  Pending = 0,
  Accepted = 1,
  Denied = 2,
  Duplicate = 3,
  Implemented = 4,
}
// The titles are the enum names.

export const FeatureRequestStatusEmojis = {
  0: "🕒",
  1: "✅",
  2: "❌",
  3: "🔁",
  4: "🏆",
};
