import { NextRequest, NextResponse } from "next/server";
import redis from "@/redis";
import config from "@/config";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import { Temporal } from "temporal-polyfill";

// Zod schema for incoming Slack request
const slackRequestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
    response_url: z.string(),
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

        // Check if the current integration is archived
        const integrations = await getWorkniceIntegrations(workniceApiKey);
        const integration = integrations.find((i) => i.id === integrationId);

        if (!integration || integration.archived) {
            console.log(`Integration ${integrationId} is archived.`);
            // Remove the Redis entries for this integration
            await redis.del(`slack_channel:calendar_update:${integrationId}`);
            await redis.del(`slack_access_token:${integrationId}`);
            await redis.del(`worknice_api_key:${integrationId}`);
            await redis.del(`slack_team_id:${integrationId}`);
            return new NextResponse('Integration is archived', { status: 200 }); // Early return if archived
        }

        // Fetch and validate with Zod
        const peopleDirectory = await getWorknicePeopleDirectory(workniceApiKey);
        const filteredPeople = getFilteredPerson(peopleDirectory, data.text);

        let responseText: { blocks: Array<{ type: string; text: { type: string; text: string }; accessory?: { type: string; image_url: string; alt_text: string } }> };
        if (filteredPeople.length > 0) {
            const person = filteredPeople[0];
            const profileImage = person.profileImage ? person.profileImage : "default_image_url";

            responseText = {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `>*<https://app.worknice.com/people/${person.id}|${person.displayName}>*\n` +
                                  `>*Position:* ${person.currentJob?.position.title ? person.currentJob?.position.title : "-"}\n` +
                                  `>*Manager:* ${person.currentJob?.position.manager?.currentJob?.person.displayName ? person.currentJob?.position.manager?.currentJob?.person.displayName : "-"}\n` +
                                  `>*Location:* ${person.location.name ? person.location.name : "-"}\n` +
                                  `>*Bio:* ${person.profileBio ? person.profileBio : "-"}\n` +
                                  `>*Pronouns:* ${person.profilePronouns ? person.profilePronouns : "-"}\n` +
                                  `>*Phone:* ${person.profilePhone ? person.profilePhone : "-"}\n` +
                                  `>*Email:* ${person.profileEmail ? person.profileEmail : "-"}\n` +
                                  `>*Birthday:* ${person.profileBirthday ? getFormattedBirthday(person.profileBirthday) : "-"}\n`
                        },
                        accessory: {
                            type: "image",
                            image_url: person.profileImage?.url,
                            alt_text: "Profile Image"
                        }
                    }
                ]
            };

        } else {
            responseText = {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Sorry, no matches for ${data.text}`
                        }
                    }
                ]
            };
        }

        // Send delayed response to Slack
        await sendDelayedResponse(data.response_url, responseText.blocks);

        return new NextResponse('Background job completed', { status: 200 });
    } catch (error: unknown) {
        console.error("Error in background task:", error);
        return new NextResponse('Error in background job', { status: 500 });
    }
};

// Utility functions

// Zod schema for the Worknice people directory response
const worknicePeopleDirectorySchema = z.object({
    data: z.object({
        session: z.object({
            org: z.object({
                people: z.array(
                    z.object({
                        id: z.string(),
                        displayName: z.string(),
                        status: z.literal("ACTIVE").nullable(),
                        role: z.string().nullable(),
                        employeeCode: z.string().nullable(),
                        profileImage: z.object({
                            url: z.string(),
                        }).nullable(),
                        profileBio: z.string().nullable(),
                        profileEmail: z.string().nullable(), 
                        profilePhone: z.string().nullable(),
                        startDate: z.string().nullable(), 
                        currentJob: z.object({
                            position: z.object({
                                title: z.string(),
                                manager: z.object({
                                    currentJob: z.object({
                                        person: z.object({
                                            displayName: z.string(),
                                        }),
                                    }),
                                }).nullable(),
                            }),
                        }).nullable(),
                        profilePronouns: z.string().nullable(),
                        profileBirthday: z.object({
                            day: z.number(),
                            month: z.number(),
                        }).nullable(),
                        location: z.object({
                            name: z.string().nullable(),
                        }).nullable(),
                    })
                ),
            }),
        }),
    }),
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
}


// Get the Worknice integrations so we can check whether they are archived or not
async function getWorkniceIntegrations(apiKey: string): Promise<{ id: string, archived: boolean }[]> {
    const response = await fetchWithZod(
        z.object({
            data: z.object({
                session: z.object({
                    org: z.object({
                        integrations: z.array(
                            z.object({
                                id: z.string(),
                                archived: z.boolean(),
                            })
                        ),
                    }),
                }),
            }),
        }),
        `${config.worknice.baseUrl}/api/graphql`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "worknice-api-token": apiKey,
            },
            body: JSON.stringify({
                query: `
          query Integrations {
            session {
              org {
                integrations(includeArchived: true) {
                  id
                  archived
                }
              }
            }
          }
        `,
            }),
        }
    );
    return response.data.session.org.integrations;
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
                                profilePhone
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
                                location {name}
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


function getFilteredPerson(peopleDirectory: any[], searchText: string) {
    const stopWords = [
        'from', 'the', 'and', 'a', 'an', 'at', 'in', 'on', 'with', 'of', 
        'for', 'to', 'by', 'about', 'as', 'is', 'it', 'this', 'that', 'are', 'or'
    ]; // Expanded stop words list

    const tokens = searchText
        .toLowerCase()
        .replace(/[!.,?;:'"-_@#$%&*+=/\\]/g, '') // Remove special characters
        .split(' ')
        .filter(token => !stopWords.includes(token)); // Filter out stop words

    if (tokens.length === 0) {
        return []; // If only stop words were given, return no matches
    }

    // Precompute lowercase fields and store them for reuse
    const lowerCasePeople = peopleDirectory.map(person => ({
        ...person,
        lowerCaseDisplayName: person.displayName.toLowerCase(),
        lowerCaseJobTitle: person.currentJob?.position.title?.toLowerCase() || '',
        lowerCaseLocation: person.location?.name?.toLowerCase() || ''
    }));

    // Try to find an exact match first (full name match)
    const exactMatch = lowerCasePeople.find(person =>
        person.lowerCaseDisplayName === searchText.toLowerCase()
    );

    if (exactMatch) {
        return [exactMatch]; // Return the exact match if found
    }

    // If no exact match, filter for partial matches
    for (const person of lowerCasePeople) {
        const nameParts: string[] = person.lowerCaseDisplayName.split(' '); // Explicitly type as string[]

        // Check if every token is found in either name parts, job title, or location
        const isMatch = tokens.every(token =>
            nameParts.some((part: string) => part.includes(token)) || // Match on name
            person.lowerCaseJobTitle.includes(token) || // Match on job title
            person.lowerCaseLocation.includes(token) // Match on location
        );

        if (isMatch) {
            return [person]; // Return as soon as the first match is found
        }
    }

    return []; // No matches found
}



// Function to format the birthday using Temporal
function getFormattedBirthday(birthday: { month: number, day: number }): string {
    const date = Temporal.PlainDate.from({ year: 2000, month: birthday.month, day: birthday.day });
    return date.toLocaleString('en-US', { day: 'numeric', month: 'long' });
}

async function sendDelayedResponse(responseUrl: string, blocks: any[]) {
    const delayedResponse = await fetch(responseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ blocks, }),
    });

    if (!delayedResponse.ok) {
        throw new Error("Failed to send delayed response.");
    }
}