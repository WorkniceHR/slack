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

        const authorizationCode = crypto.randomBytes(16).toString("hex");

        logger.debug("Saving authorization code…");

        await redis.set(
          `session_code_integration_id:${authorizationCode}`,
          payload.integrationId,
          {
            ex: config.sessionCodeExpiry,
          }
        );

        return authorizationCode;
      },
    },
    {
      apiUrl: `${config.worknice.baseUrl}/api/graphql`,
      debug: true,
    }
  );
