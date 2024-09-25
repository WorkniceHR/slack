import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "../../../redis";
import config from "@/config";

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
  //below is if you need to test with sample dates
  const today = new Date(Date.parse("2024-09-26T12:00:00+10:00"));
  //const today = new Date();

  return events.filter((event) => {
    const eventDate = new Date(Date.parse(event.startDate));
    return (
      eventDate.getFullYear() === today.getFullYear() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getDate() === today.getDate()
    );
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
  try {
    const integrationIds = await getWorkniceIntegrationIds();

    const channels: Array<string> = [];
    const slackTokens: Array<string> = [];
    const workniceTokens: Array<string> = [];
    const calendarEvents: Array<CalendarEvent[]> = [];

    for (const integrationId of integrationIds) {
      const channel = await redis.get(`slack_channel:calendar_update:${integrationId}`);
      if (typeof channel !== "string") {
        console.log(`No Slack channel found for integration ${integrationId}. Skipping.`);
        continue;
      }

      const slackToken = await redis.get(`slack_access_token:${integrationId}`);
      if (typeof slackToken !== "string") {
        console.log(`No Slack token found for integration ${integrationId}. Skipping.`);
        continue;
      }

      const workniceToken = await redis.get(`worknice_api_key:${integrationId}`);
      if (typeof workniceToken !== "string") {
        console.log(`No Worknice token found for integration ${integrationId}. Skipping.`);
        continue;
      }

      channels.push(channel);
      slackTokens.push(slackToken);
      workniceTokens.push(workniceToken);

      const events = await getWorkniceCalendarEvents(workniceToken);
      const todayEvents = filterTodayEvents(events);
      calendarEvents.push(todayEvents);
      console.log(`Fetched calendar events for integration ${integrationId}`);

      const message = formatEventMessage(todayEvents);
      await sendSlackMessage(slackToken, channel, message);
      console.log(`Sent Slack message for integration ${integrationId}`);
    }

    return NextResponse.json({
      test: "hello world",
      integrationIds: integrationIds,
      channels: channels,
      slackTokens: slackTokens,
      workniceTokens: workniceTokens,
      calendarEvents: calendarEvents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};
