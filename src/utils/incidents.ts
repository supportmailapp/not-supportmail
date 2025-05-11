import { HydratedDocument } from "mongoose";
import * as BetterStack from "./betterstack.js";
import { IIncident } from "../models/incident.js";
import { IncidentStatus } from "./enums.js";

export const betterstackClient = BetterStack.createBetterStackClient({
  apiKey: process.env.BTSTACK_API_KEY,
  statusPageId: process.env.BTSTACK_STATUSPAGE_ID,
});

const statuspageOrigin = process.env.STATUSPAGE_ORIGIN;

export function isBetterStackEnabled(): boolean {
  return betterstackClient !== null;
}

export function incidentURL(
  incident: HydratedDocument<IIncident>
): string | null {
  if (statuspageOrigin) {
    if (incident.typ === "maintenance") {
      return `${statuspageOrigin}/maintenance/${incident.betterstack.id}`;
    } else {
      return `${statuspageOrigin}/incident/${incident.betterstack.id}`;
    }
  }
  return null;
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
