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
      calendarEvents.push(events);
      console.log(`Fetched calendar events for integration ${id}`);
    } catch (error) {
      console.error(`Error fetching calendar events for integration ${id}:`, error);
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

/*


interface CustomerData {
  integrationId: string;
  channel: string | null;
  slackToken: string | null;
  workniceApiKey: string | null;
}

async function getCustomerData(): Promise<CustomerData[]> {
  const integrationIds = await getWorkniceIntegrationIds();
  const dataPromises = integrationIds.map(async (id) => {
    const channel = await redis.get(`slack_channel:calendar_update:${id}`);
    const slackToken = await redis.get(`slack_access_token:${id}`);
    const workniceApiKey = await redis.get(`worknice_api_key:${id}`);
    return { integrationId: id, channel, slackToken, workniceApiKey };
  });
  return Promise.all(dataPromises);
}

async function getWorkniceCalendarEvents(apiKey: string): Promise<any[]> {
  const response = await fetchWithZod(
    z.object({
      data: z.object({
        calendarEvents: z.array(z.any()) // Adjust this schema as needed
      }),
    }),
    "http://app.worknice.com/api/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "worknice-api-token": apiKey,
      },
      body: JSON.stringify({
        query: `
          query GetCalendarEvents {
            calendarEvents {
              id
              title
              startDate
              endDate
              # Add any other fields you need
            }
          }
        `,
      }),
    }
  );

  return response.data.calendarEvents;
}

async function sendSlackMessage(token: string, channel: string, message: string): Promise<void> {
  const request = new NextRequest('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channel, text: message })
  });
  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const customers = await getCustomerData();

    for (const customer of customers) {
      if (!customer.workniceApiKey || !customer.slackToken || !customer.channel) {
        console.log(`Skipping customer ${customer.integrationId} due to missing data`);
        continue;
      }

      // Get Worknice calendar events
      const events = await getWorkniceCalendarEvents(customer.workniceApiKey);

      // Prepare message
      const message = `You have ${events.length} upcoming events in your calendar.`;

      // Send Slack message
      await sendSlackMessage(customer.slackToken, customer.channel, message);

      console.log(`Processed customer ${customer.integrationId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing customers:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
};

*/