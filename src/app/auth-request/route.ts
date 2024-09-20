import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import config from "../../config";
import redis from "../../redis";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    console.log("Retrieving session code…");

    const cookieStore = cookies();

    const sessionCode = request.nextUrl.searchParams.get(
      config.sessionCodeParam
    );

    if (sessionCode === null) {
      throw Error("Missing session code.");
    }

    console.log("Retrieving integration ID…");

    const integrationId = await redis.get<string>(
      `session_code_integration_id:${sessionCode}`
    );

    if (integrationId === null) {
      throw Error("Authorization request not found");
    }

    console.log("Saving session code to cookie…");

    cookieStore.set(config.sessionCodeCookieName, sessionCode, {
      maxAge: config.sessionCodeExpiry,
    });

    console.log("Done.");

    return NextResponse.redirect(
      `https://slack.com/oauth/v2/authorize?scope=${config.slack.scopes.join(
        ","
      )}&client_id=${config.slack.clientId}&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};
