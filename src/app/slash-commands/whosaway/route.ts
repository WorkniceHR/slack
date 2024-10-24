import redis from "@/redis";
import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import gql from "dedent";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

type Env = {
  integrationId: string;
};

export const POST = async (request: Request) =>
  handleRequestWithWorknice<z.infer<typeof slackRequestSchema>, undefined, Env>(
    request,
    {
      getApiToken: async ({ env }) => {
        const token = await redis.getWorkniceApiKey(env.integrationId);
        if (token === null) {
          throw Error("Unable to find Worknice API token.");
        }
        return token;
      },
      getEnv: async ({ payload }) => {
        const integrationId = await redis.getIntegrationIdFromTeamId(
          payload.team_id
        );

        if (integrationId === null) {
          throw new Error("Integration ID not found.");
        }

        return {
          integrationId,
        };
      },
      handleRequest: async ({ payload, worknice }) => {
        const rawLeaveRequests = await worknice.fetchFromApi(
          gql`
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
        );

        // Fetch the leave requests from Worknice API
        const events =
          workniceLeaveRequestSchema.parse(rawLeaveRequests).data.session.org
            .sharedCalendarEvents;

        const today = Temporal.Now.plainDateISO("Australia/Sydney");

        const leaveRequests = events.filter(
          (
            event
          ): event is SharedCalendarEvent & {
            startDate: string;
            endDate: string;
            owner: { displayName: string };
          } => {
            if (event.eventType !== "LeaveRequest") {
              return false;
            }

            if (!event.startDate || !event.endDate) {
              return false;
            }

            if (event.owner === null) {
              return false;
            }

            const startDate = Temporal.PlainDate.from(event.startDate);
            const endDate = Temporal.PlainDate.from(event.endDate);

            // Check if today falls between startDate and endDate (inclusive)
            const isTodayInRange =
              Temporal.PlainDate.compare(startDate, today) <= 0 &&
              Temporal.PlainDate.compare(endDate, today) >= 0;

            return isTodayInRange;
          }
        );

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
            const endDate = Temporal.PlainDate.from(
              event.endDate
            ).toLocaleString("en-US", { month: "short", day: "2-digit" });
            responseText += `>*${event.owner.displayName}* ${startDate} - ${endDate}\n`;
          });
        } else {
          responseText = ":raised_hands: All hands on deck!";
        }

        const delayedResponse = await fetch(payload.response_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: responseText }),
        });

        if (!delayedResponse.ok) {
          throw new Error("Failed to send delayed response.");
        }
      },
      parsePayload: async ({ request }) => {
        const text = await request.text();

        const signature = request.headers.get("X-Slack-Signature");

        if (signature === null) {
          throw Error("Missing signature header.");
        }

        const timestamp = request.headers.get("X-Slack-Request-Timestamp");

        if (timestamp === null) {
          throw Error("Missing timestamp header.");
        }

        slack.verifyRequest(timestamp, signature, text);

        return slackRequestSchema.parse(JSON.parse(text));
      },
    }
  );

type SharedCalendarEvent = z.infer<
  typeof workniceLeaveRequestSchema
>["data"]["session"]["org"]["sharedCalendarEvents"][number];

const slackRequestSchema = z.object({
  user_id: z.string(),
  text: z.string(),
  team_id: z.string(),
  response_url: z.string(),
});

const workniceLeaveRequestSchema = z.object({
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
});
