import { handleGetAuthorizationUrlWebhook } from "@worknice/js-sdk/helpers";
import crypto from "crypto";
import config from "../../../config";
import redis from "../../../redis";

export const POST = async (request: Request): Promise<Response> =>
  handleGetAuthorizationUrlWebhook(
    request,
    {
      getAuthorisationUrl: async ({ logger, payload }) => {
        logger.debug("Generating authorization code…");

        const sessionCode = crypto.randomBytes(16).toString("hex");

        logger.debug("Saving authorization code…");

        await redis.setIntegrationIdFromSessionCode(
          sessionCode,
          payload.integrationId
        );

        return `${config.baseUrl}/auth-request?${config.sessionCodeParam}=${sessionCode}`;
      },
    },
    {
      apiUrl: `${config.worknice.baseUrl}/api/graphql`,
      debug: true,
    }
  );
