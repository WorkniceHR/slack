import { NextRequest, NextResponse } from "next/server";
import config from "../../../config";
import redis from "../../../redis";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const ids = await getWorkniceIntegrationIds();

  // We're only doing this so we can add the values to the response. This isn't
  // actually needed to post a message to the Slack channel.
  const channels: Array<string> = [];

  // Looping through all the ID's like this is probably going to be an easier
  // pattern to implement than the `dataPromises` you've currently got.
  for (const id of ids) {
    const channel = await redis.get(`slack_channel:calendar_update:${id}`);

    // We're only doing this so we can add the values to the response. This isn't
    // actually needed to post a message to the Slack channel.
    if (typeof channel === 'string') {
      channels.push(channel);
    }
  }

  // Returning some data for testing purposes only.
  return NextResponse.json({
    test: "hello world",
    ids: ids,
    channels: channels,
  });
};

async function getWorkniceIntegrationIds(): Promise<string[]> {
  const keys = await redis.keys("worknice_api_key:*");
  return keys.map(key => key.split(":")[1]).filter((id): id is string => id !== undefined);
}

/*
import { z } from 'zod';

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