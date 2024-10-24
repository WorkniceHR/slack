import config from "@/config";
import redis from "@/redis";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";

export const GET = async (request: Request) =>
  handleRequestWithWorknice(request, {
    getApiToken: async () => "",
    getEnv: async () => null,
    handleRequest: async ({ logger }) => {
      const integrationIds = await redis.getAllIntegrationIds();

      logger.debug(`${integrationIds.length} integrations found.`);

      await Promise.all(
        integrationIds.map((integrationId) =>
          fetch(`${config.baseUrl}/alerts/calendar-update/${integrationId}`, {
            headers: {
              authorization: `Bearer ${config.vercel.cronSecret}`,
            },
          })
        )
      );

      logger.debug("Complete.");

      return undefined;
    },
    parsePayload: async ({ request }) => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${config.vercel.cronSecret}`) {
        throw Error("Unauthorised.");
      }

      return null;
    },
  });
