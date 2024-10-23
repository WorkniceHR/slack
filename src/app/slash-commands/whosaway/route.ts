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

// Main function below
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const data = await request.json();
    // Validate incoming request with Zod schema
    slackRequestSchema.parse(data);

    const integrationId = await redis.getIntegrationIdFromTeamId(data.team_id);

    if (integrationId === null) {
      throw new Error("Integration ID not found.");
    }

    const workniceApiKey = await redis.getWorkniceApiKey(integrationId);

    if (!workniceApiKey) {
      throw new Error("API key not found.");
    }

    // Fetch the leave requests from Worknice API
    const leaveRequests = await getLeaveRequests(workniceApiKey);

    let responseText = "";
    if (leaveRequests.length > 0) {
      responseText = `:desert_island: There ${
        leaveRequests.length === 1
          ? "is *1 person*"
          : `are *${leaveRequests.length} people*`
      } on leave:\n`;
      leaveRequests.forEach((event) => {
        const startDate = Temporal.PlainDate.from(
          event.startDate
        ).toLocaleString("en-US", { month: "short", day: "2-digit" });
        const endDate = Temporal.PlainDate.from(event.endDate).toLocaleString(
          "en-US",
          { month: "short", day: "2-digit" }
        );
        responseText += `>*${event.owner.displayName}* ${startDate} - ${endDate}\n`;
      });
    } else {
      responseText = ":raised_hands: All hands on deck!";
    }

    // Send delayed response to Slack
    await sendDelayedResponse(data.response_url, responseText);

    return new NextResponse("Leave data processed", { status: 200 });
  } catch (error: unknown) {
    console.error("Error in leave processing task:", error);
    return new NextResponse("Error in leave processing", { status: 500 });
  }
};

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
                owner: z
                  .object({
                    displayName: z.string().optional(),
                  })
                  .optional(),
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
                `,
      }),
    }
  );

  // Filter for "LeaveRequest" events
  const leaveRequests = response.data.session.org.sharedCalendarEvents.filter(
    (event) => event.eventType === "LeaveRequest"
  );

  // Filter the events for today's date
  return filterTodayEvents(leaveRequests);
}

// Filter events for today's date using Temporal
function filterTodayEvents(events: any[]): any[] {
  const today = Temporal.Now.plainDateISO("Australia/Sydney");

  return events.filter((event) => {
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
