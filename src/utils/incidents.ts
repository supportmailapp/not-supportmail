import { HydratedDocument } from "mongoose";
import * as BetterStack from "./betterstack.js";
import { IIncident } from "../models/incident.js";

const betterstackClient = BetterStack.createBetterStackClient({
  apiKey: process.env.BTSTACK_API_KEY,
});

export { betterstackClient };

export function incidentURL(incident: HydratedDocument<IIncident>): string {
  if (incident.typ === "maintenance") {
    return `https://betterstack.com/status/maintenance/${incident.betterstack.id}`;
  } else {
    return `https://betterstack.com/status/incident/${incident.betterstack.id}`;
  }
}
