import type { APIMessageTopLevelComponent, JSONEncodable } from "discord.js";

declare global {
  type TopLevelMessageComponent = JSONEncodable<APIMessageTopLevelComponent>;

  type PriorityLevel = "P0" | "P1" | "P2";
}

export {};
