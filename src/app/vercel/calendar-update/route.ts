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
                startDate: z.string(),
                endDate: z.string(),
                owner: z.object({
                  displayName: z.string()
                })
              })
            )
          })
        })
      })
    }),
    'https://api.worknice.com/graphql',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: `
          query {
            session {
              org {
                sharedCalendarEvents {
                  id
                  eventType
                  startDate
                  endDate
                  owner {
                    displayName
                  }
                }
              }
            }
          }
        `
      })
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

interface CalendarEvent {
  startDate: string;
  endDate: string;
  eventType: string;
  owner: {
    displayName: string;
  };
}

function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const sydneyTime = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
  const today = new Date(sydneyTime).toISOString().split('T')[0];
  
  return events.filter(event => {
    return event.startDate <= today && today <= event.endDate;
  });
}

function formatEventMessage(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return "No calendar updates for today :sunny:";
  }

  const eventsByType: { [key: string]: string[] } = {};

  events.forEach(event => {
    const eventType = event.eventType || 'Other';
    if (!eventsByType[eventType]) {
      eventsByType[eventType] = [];
    }
    eventsByType[eventType].push(event.owner.displayName);
  });

  let message = "*Here's what's happening today:*\n\n";

  for (const [eventType, names] of Object.entries(eventsByType)) {
    let emoji = '';
    let heading = '';
    switch (eventType) {
      case 'LeaveRequest':
        emoji = ':desert_island:';
        heading = 'Away';
        break;
      case 'BirthdayEvent':
        emoji = ':birthday:';
        heading = 'Birthdays';
        break;
      case 'AnniversaryEvent':
        emoji = ':tada:';
        heading = 'Anniversaries';
        break;
      default:
        emoji = ':calendar:';
        heading = eventType;
    }

    message += `>${emoji} * ${heading} (${names.length})*\n`;
    message += `>${names.join(', ')}\n\n`;
  }

  return message.trim();
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  // Check for the CRON_SECRET
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const integrationIds = await getWorkniceIntegrationIds();
    let allEvents: CalendarEvent[] = [];

    for (const id of integrationIds) {
      const apiKey = await redis.get(`worknice_api_key:${id}`);
      if (apiKey) {
        const events = await getWorkniceCalendarEvents(apiKey);
        allEvents = allEvents.concat(events);
      }
    }

    const todayEvents = filterTodayEvents(allEvents);
    const message = formatEventMessage(todayEvents);

    await sendSlackMessage(config.slackToken, config.slackChannel, message);

    return NextResponse.json({ message: 'Calendar update sent to Slack successfully' });
  } catch (error) {
    console.error('Error in calendar update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};