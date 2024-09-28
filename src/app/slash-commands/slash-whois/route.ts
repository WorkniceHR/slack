import { NextRequest, NextResponse } from "next/server";
import redis from "../../../../redis";
import config from "../../../../config";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";

// Zod schema for incoming Slack request
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
                        status: z.literal("ACTIVE").nullable(), 
                        role: z.string().nullable(), 
                        employeeCode: z.string().nullable(), 
                        profileImage: z.object({
                            url: z.string(),
                        }).nullable(), 
                        profileBio: z.string().nullable(), 
                        profileEmail: z.string().nullable(), // profileEmail can be null
                        startDate: z.string().nullable(), // startDate can be null
                        currentJob: z.object({
                            position: z.object({
                                title: z.string(),
                                manager: z.object({
                                    currentJob: z.object({
                                        person: z.object({
                                            displayName: z.string(),
                                        }),
                                    }),
                                }).nullable(), // manager can be null
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
        const filteredPeople = getFilteredPerson(peopleDirectory, data.text);
        
        let responseText = "";
        if (filteredPeople.length > 0) {
            const person = filteredPeople[0];
            responseText = `> *<https://app.worknice.com/people/${person.id}|${person.displayName}>*\n`;
            responseText += `>*Position:* ${person.currentJob?.position.title ? person.currentJob?.position.title : "-"}\n`;
            responseText += `>*Manager:* ${person.currentJob?.position.manager?.currentJob?.person.displayName ? person.currentJob?.position.manager?.currentJob?.person.displayName : "-"}\n`;
            responseText += `>*Location:* ${person.location.name ? person.location.name : "-"}\n`;
            responseText += `>*Bio:* ${person.profileBio ? person.profileBio : "-"}\n`;
            responseText += `>*Pronouns:* ${person.profilePronouns ? person.profilePronouns : "-"}\n`;
            responseText += `>*Phone:* ${person.profilePhone ? person.profilePhone : "-"}\n`;
            responseText += `>*Email:* ${person.profileEmail ? person.profileEmail : "-"}\n`;
            responseText += `>*Birthday:* ${person.profileBirthday ? getFormattedBirthday(person.profileBirthday) : "-"}\n`;
        } else {
            responseText = `Sorry, no matches for ${data.text}`;
        }

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
    const tokens = searchText.toLowerCase().split(' '); // Split search text into tokens

    // Try to find an exact match first (full name match)
    const exactMatch = peopleDirectory.find(person =>
        person.displayName.toLowerCase() === searchText.toLowerCase()
    );

    if (exactMatch) {
        return [exactMatch]; // Return the exact match if found
    }

    // If no exact match, filter for partial matches
    const partialMatches = peopleDirectory.filter(person => {
        const nameParts = person.displayName.toLowerCase().split(' ');
        const jobTitle = person.currentJob?.position.title?.toLowerCase() || '';
        const location = person.location?.name?.toLowerCase() || '';

        // Check if every token is found in either name parts, job title, or location
        return tokens.every(token =>
            nameParts.some((part: string) => part.includes(token)) || // Match on name
            jobTitle.includes(token) || // Match on job title
            location.includes(token) // Match on location
        );
    });

    // Return the top partial match if found, otherwise return an empty array
    if (partialMatches.length > 0) {
        return [partialMatches[0]]; // Return the first partial match
    } else {
        return []; // No matches found
    }
}


// Function to format the birthday
function getFormattedBirthday(birthday: { month: number, day: number }): string {
    const daySuffix = getDaySuffix(birthday.day);
    const monthName = getMonthName(birthday.month);
    return `${birthday.day}${daySuffix} ${monthName}`;
}

// Function to get the suffix for the day
function getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) {
        return "th";
    }
    switch (day % 10) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
        default:
            return "th";
    }
}

// Function to get the month name
function getMonthName(month: number | undefined): string {
    const monthNames = [
        "January", "February", "March", "April", "May", "June", "July",
        "August", "September", "October", "November", "December"
    ];

    // Ensure month is defined and within the valid range
    if (month !== undefined && month >= 1 && month <= 12) {
        return monthNames[month - 1]!;
    }

    return "";
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