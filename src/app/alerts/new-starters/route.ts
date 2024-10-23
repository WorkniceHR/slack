import { NextRequest, NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "@/redis";
import config from "@/config";
import slack, { type Block } from "@/slack";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const integrationIds = await redis.getAllIntegrationIds();

    for (const integrationId of integrationIds) {
      const channel = await redis.getNewStarterSlackChannel(integrationId);
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

      const people = await getPeopleStartingToday(workniceToken);
      if (people.length === 0) {
        console.log(
          `No people starting today for integration ${integrationId}.`
        );
        continue;
      }

      const blocks = people.map((person) => formatSlackBlockMessage(person));
      await slack.postChatMessage(slackToken, channel, { blocks });
      console.log(`Sent Slack block message for integration ${integrationId}`);
    }

    return NextResponse.json({ status: "Success" });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;
    return new NextResponse(message, { status: 500 });
  }
};

// Query Worknice to a list of all people and filter to people starting today
async function getPeopleStartingToday(apiKey: string): Promise<Person[]> {
  const response = await fetchWithZod(
    peopleListSchema,
    `${config.worknice.baseUrl}/api/graphql`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "worknice-api-token": apiKey,
      },
      body: JSON.stringify({
        query: `
          query PeopleList {
            session {
              org {
                people(includeArchived: false, status: [ACTIVE]) {
                  id
                  displayName
                  startDate
                  location { name }
                  profileImage { url }
                  currentJob { position { title } }
                }
              }
            }
          }
        `,
      }),
    }
  );

  const today = Temporal.Now.plainDateISO("Australia/Sydney");
  return response.data.session.org.people.filter((person) => {
    const startDate = person.startDate
      ? Temporal.PlainDate.from(person.startDate)
      : null;
    return startDate && Temporal.PlainDate.compare(startDate, today) === 0;
  });
}

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

type Person = z.infer<
  typeof peopleListSchema
>["data"]["session"]["org"]["people"][number];

const fetchWithZod = createZodFetcher();
