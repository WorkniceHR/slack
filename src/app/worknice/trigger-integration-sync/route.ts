import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
//import config from "../../../config";
import redis from "../../../redis";

// Define schema for request validation
const requestSchema = z.object({
  integrationId: z.string(),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    // Validate and parse the incoming request
    const data = requestSchema.parse(await request.json());

    //Retrieve Slack access token from Redis
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

    //fetch Slack users
    console.log("Retrieving Slack users");
    const slackUsers = await fetchSlackUsers(slackAccessToken);
    console.log(`Found ${slackUsers.length} Slack users`);


    return NextResponse.json({
      test: "hello",
      slackAccessToken,
      workniceApiKey,
    }, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    console.error(error);
    return new NextResponse(message, { status: 500 });
  }
};



// Fetches users from the Slack API using the access token
const fetchSlackUsers = async (
  accessToken: string
): Promise<{ userId: string; displayName: string; email: string }[]> => {
  const response = await fetch("https://slack.com/api/users.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error("Failed to fetch Slack users.");
  }

  // Map through users and return userId, displayName, and email
  return data.members.map((user: any) => ({
    userId: user.id,
    displayName: user.profile.real_name || user.name,
    email: user.profile.email || '',
  }));
};

