import { NextRequest, NextResponse } from "next/server";
import config from "../../../config";
import redis from "../../../redis";
import { z } from 'zod';

async function getWorkniceIntegrationIds(): Promise<string[]> {
  const keys = await redis.keys("worknice_api_key:*");
  return keys.map(key => key.split(":")[1]).filter((id): id is string => id !== undefined);
}

async function fetchWithZod<T extends z.ZodType>(
  schema: T,
  url: string,
  options: RequestInit
): Promise<z.infer<T>> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return schema.parse(data);
}

async function getWorkniceCalendarEvents(apiKey: string): Promise<any[]> {
  const response = await fetchWithZod(
    z.object({
      data: z.object({
        session: z.object({
          org: z.object({
            sharedCalendarEvents: z.array(
              z.object({
                id: z.string(),
                eventType: z.string(),
                ordinalNumber: z.number().optional(),
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
    }),
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
                  ... on AnniversaryEvent {
                    ordinalNumber
                  }
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

async function sendSlackMessage(token: string, channel: string, message: string): Promise<void> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channel, text: message })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }
}

function filterTodayEvents(events: any[]): any[] {
  const sydneyTime = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
  const today = new Date(sydneyTime).toISOString().split('T')[0];

  return events.filter(event => {
    return event.startDate <= today && today <= event.endDate;
  });
}

function formatEventMessage(events: any[]): string {
  if (events.length === 0) {
    return "No events today.";
  }

  return events.map(event => {
    let message = `${event.eventType}: ${event.owner.displayName}`;
    if (event.eventType === "AnniversaryEvent" && event.ordinalNumber) {
      message += ` (${event.ordinalNumber}${getOrdinalSuffix(event.ordinalNumber)} anniversary)`;
    }
    return message;
  }).join("\n");
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const ids = await getWorkniceIntegrationIds();

  const channels: Array<string> = [];
  const slackTokens: Array<string> = [];
  const workniceTokens: Array<string> = [];
  const calendarEvents: Array<any> = [];

  for (const id of ids) {
    const channel = await redis.get(`slack_channel:calendar_update:${id}`);
    if (typeof channel !== 'string') {
      console.log(`No Slack channel found for integration ${id}. Skipping.`);
      continue;
    }

    const slackToken = await redis.get(`slack_access_token:${id}`);
    if (typeof slackToken !== 'string') {
      console.log(`No Slack token found for integration ${id}. Skipping.`);
      continue;
    }

    const workniceToken = await redis.get(`worknice_api_key:${id}`);
    if (typeof workniceToken !== 'string') {
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