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

    const keys = await redis.keys('slack_team_id:*');

    for (const key of keys) {
        const storedTeamId = await redis.get(key);

        if (storedTeamId === team_id) {
            const integrationId = key.split(':')[1];
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
                        status: z.literal("ACTIVE"),
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

// Background fetcher using zod-fetch
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
        const body = parse(await request.text());

        const data = slackRequestSchema.parse(body);

        const immediateResponse = NextResponse.json(
            { text: "Searching the employee directory..." },
            { status: 200 }
        );

        // Send the immediate response and then execute the background task
        (async () => {
            try {
                const integrationId = await getIntegrationId(data.team_id);

                const workniceApiKey = await redis.get<string>(`worknice_api_key:${integrationId}`);

                if (!workniceApiKey) {
                    throw new Error("Worknice API key not found.");
                }

                // Fetch the directory using zod-fetch
                const peopleDirectory = await getWorknicePeopleDirectory(workniceApiKey);

                const filteredPeople = peopleDirectory.filter(person => person.displayName === data.text);

                const responseText = filteredPeople.length > 0
                    ? `Found ${filteredPeople.length} match(es) for user: ${data.text}`
                    : `No matches found for user: ${data.text}`;

                // Send the delayed response to Slack
                const delayedResponse = await fetchWithZod(
                    z.object({ ok: z.boolean() }), // Define schema for the Slack response validation
                    data.response_url,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ text: responseText }),
                    }
                );

                if (!delayedResponse.ok) {
                    throw new Error("Failed to send delayed response.");
                }

                console.log("Delayed response sent successfully.");
            } catch (error) {
                console.error("Error in background function: ", error);
            }
        })().catch((error) => console.error("Error in async background task:", error));

        // Set the background response header for Vercel
        immediateResponse.headers.set('x-vercel-id', '1'); // Marking it as a background task

        return immediateResponse;

    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return new NextResponse(message, { status: 500 });
    }
};