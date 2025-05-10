import { HydratedDocument } from "mongoose";
import * as BetterStack from "./betterstack.js";
import { IIncident } from "../models/incident.js";

const betterstackClient = BetterStack.createBetterStackClient({
  apiKey: process.env.BTSTACK_API_KEY,
});

export { betterstackClient };

export function incidentURL(incident: HydratedDocument<IIncident>): string {
  if (incident.typ === "maintenance") {
    return `https://status.supportmail.dev/maintenance/${incident.betterstack.id}`;
  } else {
    return `https://status.supportmail.dev/incident/${incident.betterstack.id}`;
  }
}
