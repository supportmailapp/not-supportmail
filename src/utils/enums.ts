import { MessageFlags } from "discord.js";

// Helper flags for message flags
export const EphemeralFlags = MessageFlags.Ephemeral as const;
export const ComponentsV2Flags = MessageFlags.IsComponentsV2 as const;
export const EphemeralV2Flags = EphemeralFlags | ComponentsV2Flags;
