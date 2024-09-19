import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "../../../redis";

async function getWorkniceIntegrationIds(): Promise<string[]> {
  const keys = await redis.keys("worknice_api_key:*");
  return keys
    .map((key) => key.split(":")[1])
    .filter((id): id is string => id !== undefined);
}

const fetchWithZod = createZodFetcher();

const workniceCalendarEventsSchema = z.object({
  data: z.object({
    session: z.object({
      org: z.object({
        sharedCalendarEvents: z.array(
          z.object({
            id: z.string(),
            eventType: z.union([
              z.literal("AnniversaryEvent"),
              z.literal("BirthdayEvent"),
              z.literal("LeaveRequest"),
            ]),
            startDate: z.string(),
            endDate: z.string(),
            owner: z.object({
              displayName: z.string(),
            }),
          })
        ),
      }),
    }),
  }),
});

async function getWorkniceCalendarEvents(apiKey: string): Promise<any[]> {
  const response = await fetchWithZod(
    workniceCalendarEventsSchema,
    "https://app.worknice.com/api/graphql",
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
                  startDate
                  endDate
                  owner {
                    displayName
                  }
                }
              }
            }
          }
        `,
      }),
    }
  );

  return response.data.session.org.sharedCalendarEvents;
}

async function sendSlackMessage(
  token: string,
  channel: string,
  message: string
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text: message }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }
}

type CalendarEvent = z.infer<
  typeof workniceCalendarEventsSchema
>["data"]["session"]["org"]["sharedCalendarEvents"][number];

function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  // const sydneyTime = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
  //just using sample dates for today for testing
  const sydneyTime = new Date("2024-07-14").toLocaleString("en-US", {
    timeZone: "Australia/Sydney",
  });

  const today = new Date(sydneyTime).toISOString().split("T")[0];

  return events.filter((event) => {
    if (!today) return false;
    return event.startDate <= today && today <= event.endDate;
  });
}

function formatEventMessage(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return "No calendar updates for today :sunny:";
  }

  let message = `*Here's what's happening today:*\n\n`;

  message += formatEventMessageSet(
    events,
    "AnniversaryEvent",
    ":tada:",
    "Anniversaries"
  );

  message += formatEventMessageSet(
    events,
    "BirthdayEvent",
    ":birthday:",
    "Birthdays"
  );

  message += formatEventMessageSet(
    events,
    "LeaveRequest",
    ":desert_island:",
    "Away"
  );

  return message.trim();
}

function formatEventMessageSet(
  events: CalendarEvent[],
  eventType: CalendarEvent["eventType"],
  emoji: string,
  heading: string
): string {
  const filteredEvents = events.filter(
    (event) => event.eventType === eventType
  );

  if (filteredEvents.length > 0) {
    return `>${emoji} *${heading} (${filteredEvents.length})*\n${filteredEvents
      .map((event) => event.owner.displayName)
      .join(", ")}\n\n`;
  }

  return "";
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const ids = await getWorkniceIntegrationIds();

  const channels: Array<string> = [];
  const slackTokens: Array<string> = [];
  const workniceTokens: Array<string> = [];
  const calendarEvents: Array<CalendarEvent[]> = [];

  for (const id of ids) {
    const channel = await redis.get(`slack_channel:calendar_update:${id}`);
    if (typeof channel !== "string") {
      console.log(`No Slack channel found for integration ${id}. Skipping.`);
      continue;
    }

    const slackToken = await redis.get(`slack_access_token:${id}`);
    if (typeof slackToken !== "string") {
      console.log(`No Slack token found for integration ${id}. Skipping.`);
      continue;
    }

    const workniceToken = await redis.get(`worknice_api_key:${id}`);
    if (typeof workniceToken !== "string") {
      console.log(`No Worknice token found for integration ${id}. Skipping.`);
      continue;
    }

    channels.push(channel);
    slackTokens.push(slackToken);
    workniceTokens.push(workniceToken);

    try {
      const events = await getWorkniceCalendarEvents(workniceToken);
      const todayEvents = filterTodayEvents(events);
      calendarEvents.push(todayEvents);
      console.log(`Fetched calendar events for integration ${id}`);

      const message = formatEventMessage(todayEvents);
      await sendSlackMessage(slackToken, channel, message);
      console.log(`Sent Slack message for integration ${id}`);
    } catch (error) {
      console.error(`Error processing integration ${id}:`, error);
    }
  }

  return NextResponse.json({
    test: "hello world",
    ids: ids,
    channels: channels,
    slackTokens: slackTokens,
    workniceTokens: workniceTokens,
    calendarEvents: calendarEvents,
  });
};
