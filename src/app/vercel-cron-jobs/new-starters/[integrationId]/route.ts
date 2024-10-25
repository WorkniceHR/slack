import config from "@/config";
import redis from "@/redis";
import slack, { type Block } from "@/slack";
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

      const rawPeople = await worknice.fetchFromApi(
        gql`
          query PeopleList {
            session {
              org {
                people(includeArchived: false, status: [ACTIVE]) {
                  id
                  displayName
                  startDate
                  location {
                    name
                  }
                  profileImage {
                    url
                  }
                  currentJob {
                    position {
                      title
                    }
                  }
                }
              }
            }
          }
        `
      );

      const people = peopleListSchema.parse(rawPeople).data.session.org.people;

      const today = Temporal.Now.plainDateISO("Australia/Sydney");

      const filteredPeople = people.filter(
        (person) =>
          person.startDate !== null &&
          Temporal.PlainDate.compare(
            Temporal.PlainDate.from(person.startDate),
            today
          ) === 0
      );

      if (filteredPeople.length === 0) {
        logger.debug(
          `No people starting today for integration ${integrationId}.`
        );
        return undefined;
      }

      const blocks = filteredPeople.map((person) =>
        formatSlackBlockMessage(person)
      );

      await slack.postChatMessage(slackToken, channel, { blocks });

      logger.debug(`Sent Slack block message for integration ${integrationId}`);

      return undefined;
    },
    parsePayload: async ({ request }) => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${config.vercel.cronSecret}`) {
        throw Error("Unauthorised.");
      }

      return null;
    },
  });

type Person = z.infer<
  typeof peopleListSchema
>["data"]["session"]["org"]["people"][number];

// Schema for people list
const peopleListSchema = z.object({
  data: z.object({
    session: z.object({
      org: z.object({
        people: z.array(
          z.object({
            id: z.string(),
            displayName: z.string(),
            startDate: z.string().nullable(),
            location: z.object({ name: z.string().nullable() }).nullable(),
            profileImage: z.object({ url: z.string().nullable() }).nullable(),
            currentJob: z
              .object({
                position: z.object({ title: z.string().nullable() }).nullable(),
              })
              .nullable(),
          })
        ),
      }),
    }),
  }),
});

// Format Slack block message
function formatSlackBlockMessage(person: Person): Block {
  const locationName = person.location?.name || "our team";
  const positionTitle = person.currentJob?.position?.title || "new team member";

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${config.worknice.baseUrl}/people/${person.id}|${person.displayName}>*\n>${person.displayName} starts today as a ${positionTitle} in ${locationName}.`,
    },
    accessory: person.profileImage?.url
      ? {
          type: "image",
          image_url: person.profileImage.url,
          alt_text: `${person.displayName}'s profile picture`,
        }
      : undefined,
  };
}
