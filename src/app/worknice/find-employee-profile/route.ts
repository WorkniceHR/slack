import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import { parse } from "querystring";
import redis from "../../../redis";
import config from "@/config";

// Request schema for incoming request
const slackRequestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
    response_url: z.string(),
});

async function getIntegrationId(team_id: string) {
    console.log("Retrieving integration ID for team ID:", team_id);

    // Get all keys matching the pattern slack_team_id:*
    const keys = await redis.keys('slack_team_id:*');

    // Iterate through the keys and find the one that matches the team_id
    for (const key of keys) {
        const storedTeamId = await redis.get(key);

        // If the team_id matches, extract the integrationId from the key
        if (storedTeamId === team_id) {
            const integrationId = key.split(':')[1];  // Extract integrationId from key
            console.log(`Found integration ID: ${integrationId}`);
            return integrationId;
        }
    }

    throw Error("Unable to retrieve integration ID for the given team ID.");
}
const fetchWithZod = createZodFetcher();

const worknicePeopleDirectorySchema = z.object({
    data: z.object({
        session: z.object({
            org: z.object({
                people: z.array(
                    z.object({
                        id: z.string(),
                        displayName: z.string(),
                        status: z.literal("ACTIVE"), // Adjust if other statuses are needed
                        role: z.string(),
                        employeeCode: z.string().optional(),
                        profileImage: z.object({
                            url: z.string(),
                        }).optional(),
                        profileBio: z.string().optional(),
                        profileEmail: z.string(),
                        startDate: z.string(),
                        currentJob: z.object({
                            position: z.object({
                                title: z.string(),
                                manager: z.object({
                                    currentJob: z.object({
                                        person: z.object({
                                            displayName: z.string(),
                                        }),
                                    }),
                                }).optional(),
                            }),
                        }),
                        profilePronouns: z.string().optional(),
                        profileBirthday: z.object({
                            day: z.number(),
                            month: z.number(),
                        }).optional(),
                    })
                ),
            }),
        }),
    }),
});

async function getWorknicePeopleDirectory(apiKey: string): Promise<any[]> {
    const response = await fetchWithZod(
        worknicePeopleDirectorySchema,
        `${config.worknice.baseUrl}/api/graphql`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "worknice-api-token": apiKey,
            },
            body: JSON.stringify({
                query: `
          query PeopleDirectory {
            session {
              org {
                people(
                  includeArchived: false
                  status: [ACTIVE]
                ) {
                  id
                  displayName
                  status
                  role
                  employeeCode
                  profileImage { url }
                  profileBio
                  profileEmail
                  startDate
                  currentJob {
                    position {
                      title
                      manager {
                        currentJob {
                          person {
                            displayName
                          }
                        }
                      }
                    }
                  }
                  profilePronouns
                  profileBirthday { day month }
                }
              }
            }
          }
        `,
            }),
        }
    );

    return response.data.session.org.people;
}


export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        // Parse the x-www-form-urlencoded data
        const body = parse(await request.text());

        // Validate and parse the incoming request
        const data = slackRequestSchema.parse(body);

        // Return an immediate response to acknowledge the command
        const immediateResponse = NextResponse.json(
            { text: "Searching the employee directory..." },
            { status: 200 }
        );

        // Send the immediate response first before running background logic
        request.waitUntil((async () => {
            try {
                // Retrieve the integration ID based on the team_id 
                const integrationId = await getIntegrationId(data.team_id);

                // Retrieve Worknice API key from Redis
                console.log("Retrieving Worknice API key…");
                const workniceApiKey = await redis.get<string>(`worknice_api_key:${integrationId}`);

                if (workniceApiKey === null) {
                    throw new Error("Worknice API key not found.");
                }

                // Retrieve the people directory using the Worknice API Key
                const peopledirectory = await getWorknicePeopleDirectory(workniceApiKey);

                // Filter the people directory results to the person whose display name matches the 'text' from the incoming Slack message
                const filteredPeople = peopledirectory.filter(person => person.displayName === data.text);

                // Make a delayed response by sending a POST request to the response_url
                const delayedResponse = fetch(data.response_url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ text: `Delayed response for user: ${data.text}` }),
                });

                // Wait for the delayed response to complete
                await delayedResponse;

            } catch (error) {
                console.error("Error processing the delayed logic: ", error);
            }
        })());

        return immediateResponse;
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return new NextResponse(message, { status: 500 });
    }
};