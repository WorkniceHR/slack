import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import config from "../../config";
import redis from "../../redis";

export const GET = async (request: NextRequest) =>
  handleRequestWithWorknice(request, {
    getApiToken: async () => "",
    getEnv: async () => null,
    handleRequest: async ({ logger }) => {
      const cookieStore = await cookies();

      const sessionCode = request.nextUrl.searchParams.get(
        config.sessionCodeParam
      );

      if (sessionCode === null) {
        throw Error("Missing session code.");
      }

      logger.debug("Retrieved session code.");

      const integrationId = await redis.getIntegrationIdFromSessionCode(
        sessionCode
      );

      if (integrationId === null) {
        throw Error("Authorization request not found");
      }

      logger.debug("Retrieved integration ID.");

      cookieStore.set(config.sessionCodeCookieName, sessionCode, {
        maxAge: config.sessionCodeExpiry,
      });

      logger.debug("Saved session code to cookie.");

      const authorizationUrl = await slack.getAuthorizationUrl();

      return NextResponse.redirect(authorizationUrl);
    },
    parsePayload: async () => null,
  });
