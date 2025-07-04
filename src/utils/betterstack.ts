import ky from "ky";
import * as Sentry from "@sentry/node";

export const DEFAULT_BASE_URL =
  "https://uptime.betterstack.com/api/v2/status-pages/";

export const StatuspageRoutes = {
  /**
   * - GET: Fetch all status page reports
   * - POST: Create a new status page report
   *
   * @see https://betterstack.com/docs/uptime/api/list-existing-reports-on-a-status-page/
   * @see https://betterstack.com/docs/uptime/api/create-a-new-status-page-report/
   */
  reports: (pageId: string) => `${pageId}/status-reports` as const,
  /**
   * - GET: Fetch all status page report updates of a report
   * - POST: Create a new status page report update
   */
  reportUpdates: (pageId: string, reportId: string) =>
    `${pageId}/status-reports/${reportId}/status-updates` as const,
  pageResources: (pageId: string) => `${pageId}/resources` as const,
} as const;

type ResourceStatus = "resolved" | "degraded" | "downtime" | "maintenance";

interface AffectedResource {
  status_page_resource_id: string;
  status: ResourceStatus;
}

interface StatusUpdateData {
  id: string;
  type: "status_update";
  attributes: {
    message: string;
    published_at: string;
    published_at_timezone: string;
    notify_subscribers: boolean;
    status_report_id: number;
    affected_resources: AffectedResource[];
  };
}

interface RelationshipData {
  id: string;
  type: string;
}

type ReportType = "manual" | "maintenance";

type JSONStatuspageReportCreateData = {
  /**
   * The title of your new status page report.
   */
  title: string;
  /**
   * The first status update message for this report.
   */
  message: string;
  /**
   * The type of the report to be created. Expects either "manual" or "maintenance".
   * Default: "manual"
   */
  report_type: ReportType;
  affected_resources: AffectedResource[];
  /**
   * The time that will show as the time that the first status update was published at (formatted in ISO-8601).
   * Default: current time.
   */
  published_at?: string;
  /**
   * The time when the report comes into effect (formatted in ISO-8601).
   * Default: current time.
   */
  starts_at?: string;
  /**
   * The time when the report ends (formatted in ISO-8601). Only required when `report_type` is set to maintenance.
   */
  ends_at?: string;
};

type JSONStatuspageReportResponse = {
  data: {
    id: string;
    type: "status_report";
    attributes: {
      title: string;
      report_type: string;
      starts_at: string;
      ends_at: string | null;
      status_page_id: number;
      affected_resources: AffectedResource[];
      aggregate_state: ResourceStatus;
    };
    relationships: {
      status_updates: {
        data: Omit<RelationshipData, "type">[];
      };
    };
  };
  included: StatusUpdateData[];
};

type JSONStatuspageStatusUpdateCreateData = {
  /**
   * The message of the status update.
   */
  message: string;
  affected_resources: AffectedResource[];
  /**
   * The time that will show as the time that the status update was published at (formatted in ISO-8601).
   * Default: current time.
   */
  published_at?: string;
};

type JSONStatuspageStatusUpdateResponse = {
  data: {
    id: string;
    type: "status_update";
    attributes: {
      message: string;
      published_at: string;
      published_at_timezone: string;
      notify_subscribers: boolean;
      status_report_id: number;
      affected_resources: AffectedResource[];
    };
  };
};

interface BetterStackConfig {
  apiKey: string | undefined; // undefined because if the user uses process.env..., then it might be undefined
  statusPageId: string;
}

// BetterStack API client
class BetterStackClient {
  private client: typeof ky;
  private readonly STATUSPAGE_ID: string;
  private readonly resources = new Map<string, string>();

  constructor(config: BetterStackConfig) {
    if (!config.statusPageId) {
      throw new Error("Missing status page ID");
    }
    if (typeof config.apiKey !== "string") {
      throw new Error("Missing API key");
    }

    this.STATUSPAGE_ID = (process.env.BTSTACK_STATUSPAGE_ID ||
      config.statusPageId)!;

    this.client = ky.create({
      prefixUrl: new URL(DEFAULT_BASE_URL),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
      retry: {
        limit: 2,
        methods: ["get", "post", "put", "delete", "patch"],
      },
      hooks: {
        beforeError: [
          async (error) => {
            const { response } = error;
            if (response && response.body) {
              try {
                error.message = `BetterStack API Error (${
                  response.status
                }): ${await response.text()}`;
              } catch (e) {
                error.message = `BetterStack API Error: ${response.status}`;
              }
            }
            return error;
          },
        ],
      },
    });
  }

  public async start() {
    await this.loadResources();
    Sentry.logger.info("BetterStack client started");
    return this;
  }

  public async getResources() {
    if (this.resources.size === 0) {
      await this.loadResources();
    }
    return this.resources;
  }

  private async loadResources() {
    this.resources.clear();
    const response = await this.get<any>(
      StatuspageRoutes.pageResources(this.STATUSPAGE_ID)
    );
    const data = response.data;
    for (const resource of data) {
      const id = resource.id;
      const name = resource.attributes.public_name;
      this.resources.set(id, name);
    }
    console.log(`Loaded ${this.resources.size} resources from BetterStack API`);
  }

  private async get<T>(endpoint: string, options = {}): Promise<T> {
    return this.client.get(endpoint, options).json<T>();
  }

  private async post<T>(endpoint: string, data: any, options = {}): Promise<T> {
    return this.client.post(endpoint, { json: data, ...options }).json<T>();
  }

  // @ts-ignore | Maybe we need this in the future
  private async put<T>(endpoint: string, data: any, options = {}): Promise<T> {
    return this.client.put(endpoint, { json: data, ...options }).json<T>();
  }

  // @ts-ignore | Maybe we need this in the future
  private async patch<T>(
    endpoint: string,
    data: any,
    options = {}
  ): Promise<T> {
    return this.client.patch(endpoint, { json: data, ...options }).json<T>();
  }

  // @ts-ignore | Maybe we need this in the future
  private async delete<T>(endpoint: string, options = {}): Promise<T> {
    return this.client.delete(endpoint, options).json<T>();
  }

  public async createStatusReport(data: JSONStatuspageReportCreateData) {
    const response = await this.post<JSONStatuspageReportResponse>(
      StatuspageRoutes.reports(this.STATUSPAGE_ID),
      data
    );
    return response;
  }

  public async createStatusUpdate(
    reportId: string,
    data: JSONStatuspageStatusUpdateCreateData
  ) {
    const response = await this.post<JSONStatuspageStatusUpdateResponse>(
      StatuspageRoutes.reportUpdates(this.STATUSPAGE_ID, reportId),
      data
    );
    return response;
  }

  /**
   * Checks if the given input matches any resource ID or name.
   *
   * @param input - The input string to search for.
   * @param fullMatch - If true, only exact matches will be considered. Also only checks if it's a resource ID.
   * @returns The resource ID if found, otherwise null.
   */
  public async findResourceId(
    input: string,
    fullMatch = false
  ): Promise<string | null> {
    const resources = await this.getResources();
    if (fullMatch) {
      const resId = resources.get(input);
      if (resId) return resId;
      return null;
    }
    const resIds = Array.from(resources.keys());
    const resNames = Array.from(resources.values());

    let resId = resIds.find((id) => id.includes(input));
    if (resId) return resId;
    const resName = resNames.find((name) => name.includes(input));
    if (resName) {
      resId = resIds[resNames.indexOf(resName)];
      return resId;
    }
    return null;
  }

  public async findResourceName(id: string) {
    const resources = await this.getResources();
    const resName = resources.get(id);
    return resName ?? null;
  }

  public getResourceName(id: string) {
    const resName = this.resources.get(id);
    return resName ?? null;
  }
}

// Factory function to create client
const createBetterStackClient = (
  config: Partial<BetterStackConfig>
): BetterStackClient | null => {
  try {
    if (!config.apiKey || !config.statusPageId) {
      console.warn(
        "BetterStack integration disabled: Missing API key or status page ID"
      );
      return null;
    }
    return new BetterStackClient(config as BetterStackConfig);
  } catch (error) {
    console.error("Failed to initialize BetterStack client:", error);
    return null;
  }
};

export {
  AffectedResource,
  BetterStackClient,
  BetterStackConfig,
  createBetterStackClient,
  JSONStatuspageReportCreateData,
  JSONStatuspageReportResponse,
  JSONStatuspageStatusUpdateCreateData,
  JSONStatuspageStatusUpdateResponse,
  RelationshipData,
  ReportType,
  ResourceStatus,
  StatusUpdateData,
};
