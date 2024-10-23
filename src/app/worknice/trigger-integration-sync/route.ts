import { handleTriggerIntegrationSyncWebhook } from "@worknice/js-sdk/helpers";
import config from "../../../config";
import redis from "../../../redis";

type Env = {
  slackAccessToken: string;
};

export const maxDuration = 300;

export const POST = async (request: Request): Promise<Response> =>
  handleTriggerIntegrationSyncWebhook<Env>(
    request,
    {
      getApiToken: async ({ payload }) => {
        const token = await redis.getWorkniceApiKey(payload.integrationId);

        if (!token) {
          throw Error("Worknice API token not found");
        }

        return token;
      },
      getEnv: async ({ logger, payload }) => {
        logger.info("Retrieving Slack access token…");

        const slackAccessToken = await redis.getSlackAccessToken(
          payload.integrationId
        );

        if (!slackAccessToken) {
          throw Error("Unable to retrieve Slack access token");
        }

        return {
          slackAccessToken,
        };
      },
      getConfig: async () => ({
        appName: "Slack",
        mode: "connection-only",
      }),
      getRemotePeople: async ({ env }) => {
        const slackUsers = await fetchSlackUsers(env.slackAccessToken);
        return slackUsers.map((user) => ({
          bankAccounts: null,
          emergencyContacts: null,
          metadata: {
            deleted: false,
            employeeCode: null,
            sourceId: user.userId,
            targetId: null,
            updatedAt: "",
          },
          personalDetails: null,
          postalAddress: null,
          residentialAddress: null,
          profile: {
            displayName: user.displayName,
            profileEmail: user.email,
          },
          superFunds: null,
          taxDetails: null,
          tenure: null,
        }));
      },
    },
    {
      apiUrl: config.worknice.baseUrl + "/api/graphql",
      debug: true,
    }
  );

// Fetches users from the Slack API using the access token
const fetchSlackUsers = async (
  accessToken: string
): Promise<{ userId: string; displayName: string; email: string }[]> => {
  const response = await fetch("https://slack.com/api/users.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error("Failed to fetch Slack users.");
  }

  // Filter out deleted, bot, and USLACKBOT users
  const filteredUsers = data.members.filter(
    (user: any) => !user.deleted && !user.is_bot && user.id !== "USLACKBOT"
  );

  // Map through filtered users and return userId, displayName, and email
  return filteredUsers.map((user: any) => ({
    userId: user.id,
    displayName: user.profile.real_name || user.name,
    email: user.profile.email || "",
  }));
};
