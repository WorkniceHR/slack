import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { parse } from "querystring";
import { z } from "zod";

export const POST = async (request: Request) =>
  handleRequestWithWorknice<
    z.infer<typeof slackRequestSchema>,
    { text: string }
  >(request, {
    getApiToken: async () => "",
    getEnv: async () => null,
    handleRequest: async ({ logger, payload }) => {
      fetch(`https://slack.worknice.com/slash-commands/${payload.command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) {
          logger.error("Failed to delegate slash command.");
        }
      });
      return { text: "Working..." };
    },
    parsePayload: async ({ request }) => {
      const text = await request.text();
      const body = parse(text);
      const data = slackRequestSchema.parse(body);
      return data;
    },
  });

const slackRequestSchema = z.object({
  command: z.union([z.literal("/whois"), z.literal("/whosaway")]),
  response_url: z.string(),
  team_id: z.string(),
  text: z.string(),
  user_id: z.string(),
});
