import config from "@/config";
import redis from "@/redis";
import slack, { type Block } from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import gql from "dedent";
import { z } from "zod";

type Params = {
  integrationId: string;
};

type Env = {
  channel: string;
  slackToken: string;
};

export const GET = async (
  request: Request,
  props: { params: Promise<Params> }
) =>
  handleRequestWithWorknice<null, undefined, Env>(request, {
    getApiToken: async () => {
      const { integrationId } = await props.params;

      const token = await redis.getWorkniceApiKey(integrationId);

      if (token === null) {
        throw Error("Unable to find Worknice API token.");
      }

      return token;
    },
    getEnv: async () => {
      const { integrationId } = await props.params;

      const channel = await redis.getNewStarterSlackChannel(integrationId);

      if (channel === null) {
        throw Error(
          `No Slack channel found for integration ${integrationId}. Skipping.`
        );
      }

      const slackToken = await redis.getSlackAccessToken(integrationId);

      if (slackToken === null) {
        throw Error(
          `No Slack token found for integration ${integrationId}. Skipping.`
        );
      }

      return {
        channel,
        slackToken,
      };
    },
    handleRequest: async ({ env, logger, worknice }) => {
      const { integrationId } = await props.params;

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

      if (people.length === 0) {
        logger.debug(
          `No people starting today for integration ${integrationId}.`
        );
        return undefined;
      }

      const blocks = people.map((person) => formatSlackBlockMessage(person));

      await slack.postChatMessage(env.slackToken, env.channel, { blocks });

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
    accessory: {
      type: "image",
      image_url: person.profileImage?.url || "https://via.placeholder.com/150",
      alt_text: `${person.displayName}'s profile picture`,
    },
  };
}
