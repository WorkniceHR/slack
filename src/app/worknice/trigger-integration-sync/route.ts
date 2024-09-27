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

    // Sync Slack users to Worknice
    await syncSlackUsersToWorknice(slackUsers, data.integrationId, workniceApiKey);

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





// Sync Slack users to Worknice
const syncSlackUsersToWorknice = async (
  slackUsers: { userId: string; displayName: string; email: string }[],
  integrationId: string,
  apiToken: string
) => {
  try {
    // Fetch existing Worknice person connections
    const personConnections = await fetchPersonConnections(integrationId, apiToken);

    for (const slackUser of slackUsers) {
      
      // Check if the user already exists in Worknice
      const existingConnection = personConnections.find(
        (connection) => connection.remote?.id === slackUser.userId
      );

      /* Check if the person connection is LOCAL_ONLY and invite to Slack
      // Sample only - since this is only possible on enterprise plans on Slack
      const localOnlyConnection = personConnections.find(
        (connection) => connection.status === "LOCAL_ONLY" && connection.person?.id
      );

      if (localOnlyConnection) {
        // Invite the person to Slack since they are LOCAL_ONLY
        await inviteToSlack(slackUser.email, slackUser.displayName, slackAccessToken);

        console.log(`Invited ${slackUser.displayName} (${slackUser.email}) to Slack.`);
        continue; // Move to the next user
      }

      */

      // Since we are not syncing any people data connected connections can be marked as MERGED
      if (existingConnection && existingConnection.status === "CONNECTED") {
        // Update the connection status to MERGED using the correct mutation
        await updatePersonConnection(apiToken, {
          connectionId: existingConnection.id,
          remoteId: slackUser.userId,
          remoteName: slackUser.displayName,
        });

        console.log(`Updated connection for ${slackUser.displayName} to MERGED.`);
        continue; // Move to the next user
      }

      if (!existingConnection) {
        // Add Slack user as REMOTE_ONLY if no existing connection
        await createPersonConnection(apiToken, integrationId, {
          remote: {
            id: slackUser.userId,
            name: slackUser.displayName,
          },
          status: "REMOTE_ONLY",
        });

        console.log(`Added ${slackUser.displayName} (${slackUser.email}) as REMOTE_ONLY.`);
      } else {
        console.log(`Skipping ${slackUser.displayName}, already connected.`);
      }
    }
  } catch (error) {
    console.error("Error syncing Slack users to Worknice:", error);
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



// Define the personConnectionSchema to validate the GraphQL response
const personConnectionSchema = z.object({
  __typename: z.literal("PersonConnection"),
  createdAt: z.string(),
  id: z.string(),
  person: z
    .object({
      displayName: z.string(),
      id: z.string(),
    })
    .nullable(),
  remote: z
    .object({
      name: z.string(),
      id: z.string(),
      url: z.string().nullable(),
    })
    .nullable(),
  status: z.enum(["CONNECTED", "LOCAL_ONLY", "MERGED", "REMOTE_ONLY"]),
  updatedAt: z.string(),
});

// Define the createPersonConnectionSchema to validate the GraphQL response
const createPersonConnectionSchema = z.object({
  data: z.object({
    createPersonConnection: personConnectionSchema,
  }),
});

// Define the createPersonConnection function to create a person connection in Worknice
const createPersonConnection = async (
  apiToken: string,
  integrationId: string,
  input:
    | {
      personId: string;
      remote: {
        id: string;
        name: string;
      };
      status: "CONNECTED";
    }
    | {
      personId: string;
      status: "LOCAL_ONLY";
    }
    | {
      personId: string;
      remote: {
        id: string;
        name: string;
      };
      status: "MERGED";
    }
    | {
      remote: {
        id: string;
        name: string;
      };
      status: "REMOTE_ONLY";
    },
) => {
  const result = await fetchWithZod(
    createPersonConnectionSchema,
    `${config.worknice.baseUrl}/api/graphql`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "worknice-api-token": apiToken,
      },
      body: JSON.stringify({
        query: `
          mutation CreatePersonConnection($integrationId: ID!, $remote: ConnectionRemoteInput, $personId: ID, $status: ConnectionStatus!) {
            createPersonConnection(integrationId: $integrationId, remote: $remote, personId: $personId, status: $status) {
              __typename
              createdAt
              id
              person {
                displayName
                id
              }
              remote {
                name
                id
                url
              }
              status
              updatedAt
            }
          }
        `,
        variables: input.status === "CONNECTED" || input.status === "MERGED"
          ? {
            integrationId,
            personId: input.personId,
            remote: input.remote,
            status: input.status,
          }
          : input.status === "LOCAL_ONLY"
            ? {
              integrationId,
              personId: input.personId,
              status: input.status,
            }
            : {
              integrationId,
              remote: input.remote,
              status: input.status,
            },
      }),
    },
  );

  return result.data.createPersonConnection;
};

// Fetch existing person connections from Worknice API
const fetchPersonConnections = async (integrationId: string, apiToken: string) => {
  try {
    console.log("Fetching existing person connections from Worknice...");

    const response = await fetchWithZod(
      z.object({
        data: z.object({
          integration: z.object({
            connections: z.array(
              z.object({
                id: z.string(),
                person: z.object({
                  id: z.string().optional(),
                }).nullable(),  // Handle nullable person field
                remote: z.object({
                  id: z.string(),
                  name: z.string(),
                }),
                status: z.enum(["CONNECTED", "LOCAL_ONLY", "MERGED", "REMOTE_ONLY"]),
              })
            ).optional(),  // Handle missing or null connections
          }).nullable(), // Handle nullable integration
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
              integration(id: $integrationId) {
                connections {
                  id
                  ... on PersonConnection {
                    person {
                      id
                    }
                    remote {
                      id
                      name
                    }
                    status
                  }
                }
              }
            }
          `,
          variables: { integrationId },
        }),
      }
    );

    // Check if the response contains a valid array
    const connections = response.data?.integration?.connections || [];

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

//Update person connection as MERGED
const updatePersonConnection = async (
  apiToken: string,
  input: {
    connectionId: string;
    remoteId: string;
    remoteName: string;
  }
) => {
  const result = await fetchWithZod(
    z.object({
      data: z.object({
        updatePersonConnection: z.object({
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
          mutation updatePersonConnection($connectionId: ID!, $remoteId: String!, $remoteName: String!) {
            updatePersonConnection(
              connectionId: $connectionId
              status: MERGED
              remote: {id: $remoteId, name: $remoteName}
            ) {
              id
            }
          }
        `,
        variables: {
          connectionId: input.connectionId,
          remoteId: input.remoteId,
          remoteName: input.remoteName,
        },
      }),
    }
  );

  return result.data.updatePersonConnection;
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