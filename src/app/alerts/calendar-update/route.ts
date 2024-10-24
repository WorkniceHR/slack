import { NextRequest, NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "@/redis";
import config from "@/config";
import slack from "@/slack";

// Send daily summary of events to Slack channels
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${config.vercel.cronSecret}`) {
      return new NextResponse("Unauthorized", {
        status: 401,
      });
    }

    const integrationIds = await redis.getAllIntegrationIds();

    const channels: Array<string> = [];
    const slackTokens: Array<string> = [];
    const workniceTokens: Array<string> = [];
    const calendarEvents: Array<CalendarEvent[]> = [];

    for (const integrationId of integrationIds) {
      const channel = await redis.getCalendarUpdateSlackChannel(integrationId);
      if (channel === null) {
        console.log(
          `No Slack channel found for integration ${integrationId}. Skipping.`
        );
        continue;
      }

      const slackToken = await redis.getSlackAccessToken(integrationId);
      if (slackToken === null) {
        console.log(
          `No Slack token found for integration ${integrationId}. Skipping.`
        );
        continue;
      }

      const workniceToken = await redis.getWorkniceApiKey(integrationId);
      if (workniceToken === null) {
        console.log(
          `No Worknice token found for integration ${integrationId}. Skipping.`
        );
        continue;
      }

      // Fetch the list of integrations and check if the current integration is archived
      const integrations = await getWorkniceIntegrations(workniceToken);
      const integration = integrations.find((i) => i.id === integrationId);

      if (!integration || integration.archived) {
        console.log(
          `Integration ${integrationId} is archived. Removing from Redis and skipping.`
        );

        await redis.purgeIntegration(integrationId);

        continue;
      }

      channels.push(channel);
      slackTokens.push(slackToken);
      workniceTokens.push(workniceToken);

      const events = await getWorkniceCalendarEvents(workniceToken);
      const todayEvents = filterTodayEvents(events);
      calendarEvents.push(todayEvents);
      console.log(`Fetched calendar events for integration ${integrationId}`);
      console.log(`All Worknice Events ${JSON.stringify(events)}`);
      console.log(`Filtered Worknice Events ${JSON.stringify(todayEvents)}`);

      const message = formatEventMessage(todayEvents);
      await slack.postChatMessage(slackToken, channel, { text: message });
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

const fetchWithZod = createZodFetcher();

// Get the Worknice integrations so we can check whether they are archived or not
async function getWorkniceIntegrations(
  apiKey: string
): Promise<{ id: string; archived: boolean }[]> {
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

// Get the calendar events from Worknice
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

type CalendarEvent = z.infer<
  typeof workniceCalendarEventsSchema
>["data"]["session"]["org"]["sharedCalendarEvents"][number];

function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = Temporal.Now.plainDateISO("Australia/Sydney");

  return events.filter((event) => {
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

// Format the calendar events into a Slack message
function formatEventMessage(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return "No calendar updates for today :sunny:";
  }

  let message = `Here's what's happening today:\n\n`;

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
