import config from "@/config";
import session from "@/session";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) =>
  handleRequestWithWorknice(request, {
    getApiToken: async () => "",
    getEnv: async () => {
      const sessionCode = request.nextUrl.searchParams.get(
        config.sessionCodeParam
      );
      if (sessionCode === null) {
        throw Error("Session code not found.");
      }
      return session.createSession(sessionCode);
    },
    handleRequest: async () =>
      NextResponse.redirect(`${config.baseUrl}/config`),
    parsePayload: async () => null,
  });
