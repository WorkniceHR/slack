import config from "@/config";
import redis from "@/redis";
import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import gql from "dedent";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

type Params = {
  integrationId: string;
};

export const GET = async (
  request: Request,
  props: { params: Promise<Params> }
) =>
  handleRequestWithWorknice(request, {
    getApiToken: async () => {
      const { integrationId } = await props.params;

      const token = await redis.getWorkniceApiKey(integrationId);

      if (token === null) {
        throw Error("Unable to find Worknice API token.");
      }

      return token;
    },
    getEnv: async () => "",
    handleRequest: async ({ logger, worknice }) => {
      const { integrationId } = await props.params;

      try {
        const integration = await worknice.getIntegration({
          integrationId,
        });

        if (integration.archived) {
          throw Error("Integration is archived.");
        }
      } catch (error) {
        await redis.purgeIntegration(integrationId);
        throw error;
      }

      const channel = await redis.getCalendarUpdateSlackChannel(integrationId);

      if (channel === null) {
        logger.debug(
          `No Slack channel found for integration ${integrationId}. Skipping.`
        );
        return undefined;
      }

      const slackToken = await redis.getSlackAccessToken(integrationId);

      if (slackToken === null) {
        logger.debug(
          `No Slack token found for integration ${integrationId}. Skipping.`
        );
        return undefined;
      }

      const rawEvents = await worknice.fetchFromApi(
        gql`
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
        `
      );

      const events =
        workniceCalendarEventsSchema.parse(rawEvents).data.session.org
          .sharedCalendarEvents;

      const todayEvents = filterTodayEvents(events);

      logger.debug(`Fetched calendar events for integration ${integrationId}.`);
      logger.debug(`Total events: ${events.length}`);
      logger.debug(`Events for today: ${todayEvents.length}`);

      const message = formatEventMessage(todayEvents);

      await slack.postChatMessage(slackToken, channel, {
        text: message,
      });

      logger.debug(`Sent Slack message for integration ${integrationId}`);
    },
    parsePayload: async ({ request }) => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${config.vercel.cronSecret}`) {
        throw Error("Unauthorised.");
      }

      return null;
    },
  });

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
      throw Error(`Error processing event ${event.id}:`, { cause: err });
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
