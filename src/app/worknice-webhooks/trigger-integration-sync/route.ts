import { handleTriggerIntegrationSyncWebhook } from "@worknice/js-sdk/helpers";
import config from "../../../config";
import redis from "../../../redis";
import slack from "@/slack";

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
        const slackUsers = await slack.listUsers(env.slackAccessToken);
        return slackUsers.map((user) => ({
          bankAccounts: null,
          dateOfBirth: null,
          emergencyContacts: null,
          fullName: null,
          gender: null,
          metadata: {
            deleted: false,
            employeeCode: null,
            sourceId: user.id,
            targetId: null,
            updatedAt: "",
          },
          personalEmail: null,
          personalPhone: null,
          postalAddress: null,
          profile: {
            displayName: user.profile.display_name,
            profileEmail: user.profile.email,
          },
          residentialAddress: null,
          superFunds: null,
          taxDetails: null,
          tenure: null,
        }));
      },
    },
    {
      apiUrl: config.worknice.baseUrl + "/api/graphql",
    }
  );
