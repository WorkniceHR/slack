import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import config from "../../../config";
import redis from "../../../redis";

// Define schema for request validation
const requestSchema = z.object({
  integrationId: z.string(),
});

const fetchWithZod = createZodFetcher();


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

    // Test fetching person connections
    await fetchPersonConnections(data.integrationId, workniceApiKey);

    // Complete the integration sync
    await completeIntegrationSync(data.integrationId, workniceApiKey);

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

  // Filter out deleted, bot, and USLACKBOT users
  const filteredUsers = data.members.filter((user: any) => !user.deleted && !user.is_bot && user.id !== 'USLACKBOT');

  // Map through filtered users and return userId, displayName, and email
  return filteredUsers.map((user: any) => ({
    userId: user.id,
    displayName: user.profile.real_name || user.name,
    email: user.profile.email || '',
  }));
};

//Complete the integration sync
async function completeIntegrationSync(integrationId: string, apiToken: string): Promise<void> {
  try {
    console.log("Completing integration sync...");

    await fetchWithZod(
      z.object({
        data: z.object({
          completeIntegrationSync: z.object({
            id: z.string(),
          }),
        }),
      }),
      `${config.worknice.baseUrl}/api/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "worknice-api-token": apiToken,
        },
        body: JSON.stringify({
          query: `
            mutation CompleteIntegrationSync($integrationId: ID!) {
              completeIntegrationSync(integrationId: $integrationId) {
                id
              }
            }
          `,
          variables: { integrationId },
        }),
      }
    );

    console.log("Integration sync completed.");
  } catch (error) {
    console.error("Error completing integration sync:", error);
    throw error;
  }
};

// Fetch existing person connections from Worknice API
const fetchPersonConnections = async (integrationId: string, apiToken: string) => {
  try {
    console.log("Fetching existing person connections from Worknice...");

    const response = await fetchWithZod(
      z.object({
        data: z.object({
          listPersonConnections: z.array(
            z.object({
              id: z.string(),
              person: z.object({
                id: z.string().optional(),
              }).optional(),
              remote: z.object({
                id: z.string(),
                name: z.string(),
                email: z.string().optional(),
              }).optional(),
              status: z.string(),
            })
          ).optional(),  // Handle optional or missing listPersonConnections
        }),
      }),
      `${config.worknice.baseUrl}/api/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "worknice-api-token": apiToken,
        },
        body: JSON.stringify({
          query: `
            query GetPersonConnections($integrationId: ID!) {
              listPersonConnections(integrationId: $integrationId) {
                id
                person {
                  id
                }
                remote {
                  id
                  name
                  email
                }
                status
              }
            }
          `,
          variables: { integrationId },
        }),
      }
    );

    // Check if the response contains a valid array
    const connections = response.data.listPersonConnections || [];

    if (!Array.isArray(connections)) {
      throw new Error("Failed to fetch person connections from Worknice.");
    }

    console.log(`Fetched ${connections.length} person connections.`);
    return connections;

  } catch (error) {
    console.error("Error fetching person connections:", error);
    throw error;
  }
};
