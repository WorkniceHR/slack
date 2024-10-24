import config from "@/config";
import session from "@/session";
import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) =>
  handleRequestWithWorknice(request, {
    getApiToken: async () => "",
    getEnv: async () =>
      session.getSession(
        request.nextUrl.searchParams.get(config.sessionCodeParam)
      ),
    handleRequest: async () => {
      const authorizationUrl = await slack.getAuthorizationUrl();
      return NextResponse.redirect(authorizationUrl);
    },
    parsePayload: async () => null,
  });
