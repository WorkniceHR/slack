import { NextRequest, NextResponse } from "next/server";
import redis from "../../../../redis"; 
import config from "../../../../config";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";

// Zod schema for the incoming Slack request
const slackRequestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
    response_url: z.string(),
});

// Zod schema for the Worknice people directory response
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

const fetchWithZod = createZodFetcher();

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const data = await request.json();
        // Validate incoming request with Zod schema
        slackRequestSchema.parse(data);

        const integrationId = await getIntegrationId(data.team_id);
        const workniceApiKey = await redis.get<string>(`worknice_api_key:${integrationId}`);

        if (!workniceApiKey) {
            throw new Error("API key not found.");
        }

        // Fetch and validate with Zod
        const peopleDirectory = await getWorknicePeopleDirectory(workniceApiKey);
        const filteredPeople = peopleDirectory.filter(person => person.displayName === data.text);

        const responseText = filteredPeople.length > 0
            ? `Found ${filteredPeople.length} match(es) for user: ${data.text}`
            : `No matches found for user: ${data.text}`;

        // Send delayed response to Slack
        await sendDelayedResponse(data.response_url, responseText);

        return new NextResponse('Background job completed', { status: 200 });
    } catch (error: unknown) {
        console.error("Error in background task:", error);
        return new NextResponse('Error in background job', { status: 500 });
    }
};

// Utility functions
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
}

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
                            people(includeArchived: false, status: [ACTIVE]) {
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
                `
            }),
        }
    );
    return response.data.session.org.people;
}

async function sendDelayedResponse(responseUrl: string, text: string) {
    const delayedResponse = await fetch(responseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    });

    if (!delayedResponse.ok) {
        throw new Error("Failed to send delayed response.");
    }
}