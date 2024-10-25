import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import config from "../../config";
import redis from "../../redis";
import session from "@/session";

type Env = {
  integrationId: string;
};

export const GET = async (request: NextRequest) =>
  handleRequestWithWorknice<null, Response, Env>(request, {
    getApiToken: async ({ env }) => {
      const token = await redis.getWorkniceApiKey(env.integrationId);

      if (token === null) {
        throw Error("Unable to retrieve API key.");
      }

      return token;
    },
    getEnv: async () => session.getSession(),
    handleRequest: async ({ env, logger, worknice }) => {
      const code = request.nextUrl.searchParams.get("code");

      if (code === null) {
        throw Error("Missing callback code.");
      }

      logger.debug("Retrieving callback code.");

      const response = await slack.getAccessToken(code);

      logger.debug("Exchanged callback code for access token.");

      await redis.setSlackAccessToken(env.integrationId, response.access_token);

      logger.debug("Saved access token.");

      await redis.setIntegrationIdFromSlackTeamId(
        response.team.id,
        env.integrationId
      );
      await redis.setSlackTeamIdFromIntegrationId(
        env.integrationId,
        response.team.id
      );

      logger.debug("Saved team ID.");

      await worknice.activateIntegration({
        id: env.integrationId,
        name: response.team.name,
      });

      logger.debug("Activated integration.");

      return Response.redirect(`${config.baseUrl}/config`);
    },
    parsePayload: async () => null,
  });
