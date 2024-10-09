import config from "@/config";
import redis from "@/redis";
import { handleCreateIntegrationWebhook } from "@worknice/js-sdk/helpers";

export const POST = async (request: Request): Promise<Response> =>
  handleCreateIntegrationWebhook(
    request,
    {
      persistDetails: async ({ payload }) => {
        await redis.set(
          `worknice_api_key:${payload.integrationId}`,
          payload.apiToken
        );
      },
    },
    {
      apiUrl: `${config.worknice.baseUrl}/api/graphql`,
      debug: true,
    }
  );
