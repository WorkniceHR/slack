import redis from "@/redis";
import slack from "@/slack";
import stemmer from "@stdlib/nlp-porter-stemmer";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import gql from "dedent";
import {
  AllSubstringsIndexStrategy,
  LowerCaseSanitizer,
  Search,
  SimpleTokenizer,
  StemmingTokenizer,
} from "js-search";
import queryString from "querystring";
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
      handleRequest: async ({ env, logger, payload, worknice }) => {
        const integration = await worknice.getIntegration({
          integrationId: env.integrationId,
        });

        logger.info("Retrieved integration.");

        if (integration.archived) {
          await redis.purgeIntegration(integration.id);
          throw Error("Integration is archived.");
        }

        const rawPeopleDirectory = await worknice.fetchFromApi(gql`
          query PeopleDirectory {
            session {
              org {
                people(includeArchived: false, status: [ACTIVE]) {
                  id
                  displayName
                  status
                  role
                  employeeCode
                  profileImage {
                    url
                  }
                  profileBio
                  profileEmail
                  profilePhone
                  startDate
                  currentJob {
                    position {
                      title
                      manager {
                        currentJob {
                          person {
                            displayName
                          }
                        }
                      }
                    }
                  }
                  profilePronouns
                  profileBirthday {
                    day
                    month
                  }
                  location {
                    name
                  }
                }
              }
            }
          }
        `);

        const peopleDirectory =
          worknicePeopleDirectorySchema.parse(rawPeopleDirectory).data.session
            .org.people;

        logger.info(`Retrieved ${peopleDirectory.length} people.`);

        const search = new Search("id");

        search.sanitizer = new LowerCaseSanitizer();

        search.tokenizer = new StemmingTokenizer(
          stemmer,
          new SimpleTokenizer()
        );

        search.indexStrategy = new AllSubstringsIndexStrategy();

        search.addIndex(["displayName"]);
        search.addIndex(["currentJob", "position", "title"]);
        search.addIndex(["location", "name"]);

        search.addDocuments(peopleDirectory);

        logger.info(`Filtered with "${payload.text}".`);

        const filteredPeople = search.search(
          payload.text
        ) as typeof peopleDirectory;

        logger.info(`Filtered down to ${filteredPeople.length} people.`);

        let responseText: {
          blocks: Array<{
            type: string;
            text: { type: string; text: string };
            accessory?: { type: string; image_url: string; alt_text: string };
          }>;
        };

        const person = filteredPeople.at(0);

        if (person) {
          responseText = {
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text:
                    `>*<https://app.worknice.com/people/${person.id}|${person.displayName}>*\n` +
                    `>*Position:* ${
                      person.currentJob?.position?.title || "-"
                    }\n` +
                    `>*Manager:* ${
                      person.currentJob?.position?.manager?.currentJob?.person
                        ?.displayName || "-"
                    }\n` +
                    `>*Location:* ${person.location?.name || "-"}\n` +
                    `>*Bio:* ${person.profileBio || "-"}\n` +
                    `>*Pronouns:* ${person.profilePronouns || "-"}\n` +
                    `>*Phone:* ${person.profilePhone || "-"}\n` +
                    `>*Email:* ${person.profileEmail || "-"}\n` +
                    `>*Birthday:* ${
                      person.profileBirthday
                        ? getFormattedBirthday(person.profileBirthday)
                        : "-"
                    }\n`,
                },
                accessory: person.profileImage?.url
                  ? {
                      type: "image",
                      image_url: person.profileImage.url,
                      alt_text: "Profile Image",
                    }
                  : undefined,
              },
            ],
          };
        } else {
          responseText = {
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `Sorry, no matches for ${payload.text}`,
                },
              },
            ],
          };
        }

        const delayedResponse = await fetch(payload.response_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replace_original: true,
            blocks: responseText.blocks,
          }),
        });

        if (!delayedResponse.ok) {
          throw new Error("Failed to send delayed response.");
        }

        return undefined;
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

        return slackRequestSchema.parse(queryString.parse(text));
      },
    }
  );

const slackRequestSchema = z.object({
  user_id: z.string(),
  text: z.string(),
  team_id: z.string(),
  response_url: z.string(),
});

const worknicePeopleDirectorySchema = z.object({
  data: z.object({
    session: z.object({
      org: z.object({
        people: z.array(
          z.object({
            id: z.string(),
            displayName: z.string(),
            status: z.literal("ACTIVE").nullable(),
            role: z.string().nullable(),
            employeeCode: z.string().nullable(),
            profileImage: z
              .object({
                url: z.string(),
              })
              .nullable(),
            profileBio: z.string().nullable(),
            profileEmail: z.string().nullable(),
            profilePhone: z.string().nullable(),
            startDate: z.string().nullable(),
            currentJob: z
              .object({
                position: z.object({
                  title: z.string(),
                  manager: z
                    .object({
                      currentJob: z.object({
                        person: z.object({
                          displayName: z.string(),
                        }),
                      }),
                    })
                    .nullable(),
                }),
              })
              .nullable(),
            profilePronouns: z.string().nullable(),
            profileBirthday: z
              .object({
                day: z.number(),
                month: z.number(),
              })
              .nullable(),
            location: z
              .object({
                name: z.string().nullable(),
              })
              .nullable(),
          })
        ),
      }),
    }),
  }),
});

function getFormattedBirthday(birthday: {
  month: number;
  day: number;
}): string {
  const date = Temporal.PlainDate.from({
    year: 2000,
    month: birthday.month,
    day: birthday.day,
  });
  return date.toLocaleString("en-US", { day: "numeric", month: "long" });
}
