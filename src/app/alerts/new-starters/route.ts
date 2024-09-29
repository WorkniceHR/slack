import { NextRequest, NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "@/redis";
import config from "@/config";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const integrationIds = await getWorkniceIntegrationIds();

        for (const integrationId of integrationIds) {
            const channel = await redis.get(`slack_channel:new_starter:${integrationId}`);
            if (typeof channel !== "string") {
                console.log(`No Slack channel found for integration ${integrationId}. Skipping.`);
                continue;
            }

            const slackToken = await redis.get(`slack_access_token:${integrationId}`);
            if (typeof slackToken !== "string") {
                console.log(`No Slack token found for integration ${integrationId}. Skipping.`);
                continue;
            }

            const workniceToken = await redis.get(`worknice_api_key:${integrationId}`);
            if (typeof workniceToken !== "string") {
                console.log(`No Worknice token found for integration ${integrationId}. Skipping.`);
                continue;
            }

            const people = await getPeopleStartingToday(workniceToken);
            if (people.length === 0) {
                console.log(`No people starting today for integration ${integrationId}.`);
                continue;
            }

            const blocks = people.map((person) => formatSlackBlockMessage(person));
            await sendSlackBlockMessage(slackToken, channel, blocks);
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
        const startDate = person.startDate ? Temporal.PlainDate.from(person.startDate) : null;
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
                        currentJob: z.object({
                            position: z.object({ title: z.string().nullable() }).nullable(),
                        }).nullable(), 
                    })
                ),
            }),
        }),
    }),
});


// Format Slack block message
function formatSlackBlockMessage(person: Person): any {
    const locationName = person.location?.name || "our team";
    const positionTitle = person.currentJob?.position?.title || "new team member";

    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: `*<${config.worknice.baseUrl}/people/${person.id}|${person.displayName}>*\n >${person.displayName} starts today as a ${positionTitle} in ${locationName}.`,
        },
        accessory: {
            type: "image",
            image_url: person.profileImage?.url || "https://via.placeholder.com/150",
            alt_text: `${person.displayName}'s profile picture`,
        },
    };
}


// Send a Slack block message
async function sendSlackBlockMessage(token: string, channel: string, blocks: any[]): Promise<void> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            channel,
            blocks,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
    }
}

type Person = z.infer<typeof peopleListSchema>["data"]["session"]["org"]["people"][number];

const fetchWithZod = createZodFetcher();

async function getWorkniceIntegrationIds(): Promise<string[]> {
    const keys = await redis.keys("worknice_api_key:*");
    return keys.map((key) => key.split(":")[1]).filter((id): id is string => id !== undefined);
}
