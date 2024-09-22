import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
//import config from "../../../config";
//import redis from "../../../redis";

// Define schema for request validation
const requestSchema = z.object({
  integrationId: z.string(),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    // Validate and parse the incoming request
    const data = requestSchema.parse(await request.json());

    /*
    // Retrieve Slack access token from Redis
    console.log("Retrieving Slack access token…");
    const slackAccessToken = await redis.get<string>(`slack_access_token:${data.integrationId}`);

    if (!slackAccessToken) {
      return NextResponse.json({ error: "Unable to retrieve Slack access token" }, { status: 404 });
    }

    // Retrieve Worknice API key from Redis
    console.log("Retrieving Worknice API key…");
    const workniceApiKey = await redis.get<string>(`worknice_api_key:${data.integrationId}`);

    if (!workniceApiKey) {
      return NextResponse.json({ error: "Unable to retrieve Worknice API key" }, { status: 404 });
    }

    */
    // Return both tokens in the response
    return NextResponse.json({
      test: "hello",
      //slackAccessToken,
      //workniceApiKey,
    }, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    return new NextResponse(message, { status: 500 });
  }
};
