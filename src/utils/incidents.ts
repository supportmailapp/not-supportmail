import { HydratedDocument } from "mongoose";
import * as BetterStack from "./betterstack.js";
import { IIncident } from "../models/incident.js";
import { IncidentStatus } from "./enums.js";

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

export function statusIsEqual(
  status1: IncidentStatus,
  status2: BetterStack.ResourceStatus
) {
  if (status1 === IncidentStatus.Resolved) {
    return status2 === "resolved";
  }
  if (status1 === IncidentStatus.Maintenance) return status2 === "maintenance";
  return true;
}
