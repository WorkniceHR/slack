import { NextRequest, NextResponse } from "next/server";
import redis from "../../../redis";
import config from "../../../config";
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

        // Fetch the leave requests from Worknice API
        const leaveRequests = await getLeaveRequests(workniceApiKey);

        let responseText = "";
        if (leaveRequests.length > 0) {
            responseText = `:desert_island: There ${leaveRequests.length === 1 ? "is *1 person*" : `are *${leaveRequests.length} people*`} on leave:\n`;
            leaveRequests.forEach((event) => {
                responseText += `>*${event.owner.displayName}* ${event.startDate} - ${event.endDate}\n`;
            });
        } else {
            responseText = ":raised_hands: All hands on deck!";
        }

        // Send delayed response to Slack
        await sendDelayedResponse(data.response_url, responseText);

        return new NextResponse('Leave data processed', { status: 200 });
    } catch (error: unknown) {
        console.error("Error in leave processing task:", error);
        return new NextResponse('Error in leave processing', { status: 500 });
    }
};

// Get the integration ID based on the slack_team_id
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

// Fetch leave requests from the Worknice API using the correct query
async function getLeaveRequests(apiKey: string): Promise<any[]> {
    const response = await fetchWithZod(
        z.object({
            data: z.object({
                session: z.object({
                    org: z.object({
                        sharedCalendarEvents: z.array(
                            z.object({
                                eventType: z.string(),
                                startDate: z.string().optional(),
                                endDate: z.string().optional(),
                                owner: z.object({
                                    displayName: z.string().optional(),
                                }).optional(),
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
                query SharedCalendarEvents {
                    session {
                        org {
                            sharedCalendarEvents {
                                id
                                eventType: __typename
                                ... on LeaveRequest {
                                    startDate
                                    endDate
                                    owner {
                                        displayName
                                    }
                                }
                            }
                        }
                    }
                }
                `
            }),
        }
    );

    // Filter for "LeaveRequest" events
    const leaveRequests = response.data.session.org.sharedCalendarEvents.filter(
        event => event.eventType === "LeaveRequest"
    );

    // Filter the events for today's date
    return filterTodayEvents(leaveRequests);
}

// Filter events for today's date using Temporal
function filterTodayEvents(events: any[]): any[] {
    const today = Temporal.Now.plainDateISO("Australia/Sydney");

    return events.filter(event => {
        if (!event.startDate || !event.endDate) {
            return false;
        }

        try {
            const startDate = Temporal.PlainDate.from(event.startDate);
            const endDate = Temporal.PlainDate.from(event.endDate);

            // Check if today falls between startDate and endDate (inclusive)
            const isTodayInRange =
                Temporal.PlainDate.compare(startDate, today) <= 0 &&
                Temporal.PlainDate.compare(endDate, today) >= 0;

            return isTodayInRange;
        } catch (err) {
            console.error(`Error processing event ${event.id}:`, err);
            return false;
        }
    });
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